import { DiffEditor, type DiffOnMount, type Monaco } from '@monaco-editor/react';
import { configureMonaco, languageForPath, monacoTheme } from './monaco-environment';

export function MonacoDiffEditor({
  path,
  original,
  modified,
  dark,
}: {
  path: string;
  original: string;
  modified: string;
  dark: boolean;
}) {
  const language = languageForPath(path);
  const mount: DiffOnMount = (editor) => {
    editor.getModifiedEditor().focus();
  };
  return (
    <section className='monaco-editor-surface monaco-diff-surface' aria-label={`比较 ${basename(path)}`}>
      <DiffEditor
        original={original}
        modified={modified}
        originalLanguage={language}
        modifiedLanguage={language}
        originalModelPath={`a3s-diff-original:///${path}`}
        modifiedModelPath={`a3s-diff-modified:///${path}`}
        theme={monacoTheme(dark)}
        beforeMount={configureMonaco as (monaco: Monaco) => void}
        onMount={mount}
        loading={<span className='monaco-loading'>正在加载差异编辑器…</span>}
        options={{
          ariaLabel: `比较 ${basename(path)}`,
          automaticLayout: true,
          diffWordWrap: 'on',
          enableSplitViewResizing: true,
          fontFamily: "'SFMono-Regular', 'Cascadia Code', Consolas, monospace",
          fontSize: 12,
          ignoreTrimWhitespace: false,
          lineHeight: 20,
          minimap: { enabled: false },
          originalEditable: false,
          readOnly: true,
          renderIndicators: true,
          renderMarginRevertIcon: false,
          renderOverviewRuler: true,
          renderSideBySide: true,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          useInlineViewWhenSpaceIsLimited: true,
        }}
      />
    </section>
  );
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}
