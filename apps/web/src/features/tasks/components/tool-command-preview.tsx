import type { ToolCallProjection } from './tool-call-projection';
import {
  type ToolSyntaxToken,
  toolInvocationPresentation,
  toolJsonSyntaxTokens,
  toolOutputExcerpt,
} from './tool-call-syntax';

export function ToolInvocationInline({ call, fallback }: { call: ToolCallProjection; fallback?: string }) {
  const presentation = toolInvocationPresentation(call);
  if (!presentation) return fallback ?? null;
  return (
    <span className='tool-invocation-inline' title={presentation.text}>
      <SyntaxTokens tokens={presentation.tokens} />
    </span>
  );
}

export function ToolOutputPreview({ output, error = false }: { output: string; error?: boolean }) {
  const excerpt = toolOutputExcerpt(output);
  if (!excerpt.lines.length) return null;
  return (
    <section className={`tool-call-output-preview ${error ? 'error' : ''}`} aria-label='工具输出'>
      <span className='tool-output-connector' aria-hidden='true'>
        └
      </span>
      <code>
        {excerpt.omittedLines > 0 && <span className='tool-output-omitted'>… 前 {excerpt.omittedLines} 行未显示</span>}
        {excerpt.lines.map((line, index) => (
          <span key={`${index}:${line}`}>{line || '\u00a0'}</span>
        ))}
        {excerpt.truncated && <span className='tool-output-omitted'>摘要已截断</span>}
      </code>
    </section>
  );
}

export function toolOutputNeedsDisclosure(output: string): boolean {
  const excerpt = toolOutputExcerpt(output);
  return excerpt.omittedLines > 0 || excerpt.truncated;
}

export function ToolJsonPreview({ content }: { content: string }) {
  return (
    <pre className='tool-json-preview'>
      <SyntaxTokens tokens={toolJsonSyntaxTokens(content)} />
    </pre>
  );
}

export function outputLineCount(output: string): number {
  const normalized = output.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  return normalized ? normalized.split('\n').length : 0;
}

function SyntaxTokens({ tokens }: { tokens: readonly ToolSyntaxToken[] }) {
  return tokens.map((token, index) => (
    <span data-syntax-role={token.role} key={`${index}:${token.role}:${token.text}`}>
      {token.text}
    </span>
  ));
}
