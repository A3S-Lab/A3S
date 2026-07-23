import { describe, expect, it } from 'vitest';
import { buildPluginDocument, pluginContentSecurityPolicy } from './plugin-document';

describe('plugin document isolation', () => {
  it('places the host CSP before package content and removes navigation primitives', () => {
    const output = buildPluginDocument(`
      <!doctype html>
      <html>
        <head>
          <base href="https://example.com/">
          <meta http-equiv="refresh" content="0;url=https://example.com/">
          <script>window.parent.postMessage('ready', '*')</script>
        </head>
        <body>Plugin</body>
      </html>
    `);
    const document = new DOMParser().parseFromString(output, 'text/html');

    expect(document.head.firstElementChild?.getAttribute('http-equiv')).toBe('Content-Security-Policy');
    expect(document.head.firstElementChild?.getAttribute('content')).toBe(pluginContentSecurityPolicy);
    expect(document.querySelector('base')).toBeNull();
    expect(document.querySelector('meta[http-equiv="refresh"]')).toBeNull();
    expect(document.querySelector('script')?.textContent).toContain('postMessage');
  });

  it('normalizes fragments into complete documents', () => {
    const output = buildPluginDocument('<main>Activity</main>');
    expect(output).toContain('<head><meta http-equiv="Content-Security-Policy"');
    expect(output).toContain('<body><main>Activity</main></body>');
  });

  it('injects only host-verified package styles and scripts as inline assets', () => {
    const output = buildPluginDocument(
      '<link rel="stylesheet" href="./ignored.css"><main>Activity</main><script src="./ignored.js"></script>',
      ['main { color: rebeccapurple; }'],
      ["window.parent.postMessage({ type: 'ready' }, '*');"]
    );
    const document = new DOMParser().parseFromString(output, 'text/html');

    expect(document.querySelector('link[rel~="stylesheet"]')).toBeNull();
    expect(document.querySelector('script[src]')).toBeNull();
    expect(document.querySelector('style[data-a3s-package-asset="style"]')?.textContent).toContain('rebeccapurple');
    expect(document.querySelector('script[data-a3s-package-asset="script"]')?.textContent).toContain('postMessage');
  });
});
