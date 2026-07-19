import { FolderOpen, LoaderCircle, SquareTerminal, Wrench } from 'lucide-react';
import type { ToolCallProjection } from './tool-call-projection';
import {
  type ToolInvocationPresentation,
  type ToolSyntaxToken,
  toolInvocationPresentation,
  toolOutputExcerpt,
} from './tool-call-syntax';
import { CopyButton } from './conversation-message-actions';

export function ToolInvocationInline({ call, fallback }: { call: ToolCallProjection; fallback?: string }) {
  const presentation = toolInvocationPresentation(call);
  if (!presentation) return fallback ?? null;
  return (
    <span className='tool-invocation-inline' title={presentation.text}>
      <SyntaxTokens tokens={presentation.tokens} />
    </span>
  );
}

export function ToolCommandPreview({ call }: { call: ToolCallProjection }) {
  const presentation = toolInvocationPresentation(call);
  if (!presentation) return null;
  const running = call.state === 'preparing' || call.state === 'running';
  const shell = presentation.kind === 'shell';
  return (
    <section
      className={`tool-command-preview ${presentation.kind} ${running ? 'running' : ''}`}
      aria-label={shell ? '命令预览' : '工具调用预览'}
    >
      <header>
        <span>
          {shell ? <SquareTerminal size={13} /> : <Wrench size={13} />}
          <strong>{shell ? '命令' : '调用'}</strong>
        </span>
        <span className='tool-command-preview-actions'>
          {running && (
            <output aria-live='polite'>
              <LoaderCircle className='spin' size={11} />
              {call.state === 'preparing' ? '正在准备' : '正在执行'}
            </output>
          )}
          <CopyButton content={presentation.text} label={shell ? '复制命令' : '复制工具调用'} />
        </span>
      </header>
      <div className='tool-command-line'>
        <span className='tool-command-prompt' aria-hidden='true'>
          {shell ? '$' : '›'}
        </span>
        <code>
          <SyntaxTokens tokens={presentation.tokens} />
        </code>
      </div>
      {presentation.cwd && <WorkingDirectory presentation={presentation} />}
    </section>
  );
}

export function ToolCollapsedOutputPreview({ output }: { output: string }) {
  const excerpt = toolOutputExcerpt(output);
  if (!excerpt.lines.length) return null;
  return (
    <section className='tool-call-collapsed-preview' aria-label='输出预览'>
      <span className='tool-output-connector' aria-hidden='true'>
        ⎿
      </span>
      <code>
        {excerpt.omittedLines > 0 && <span className='tool-output-omitted'>… 前 {excerpt.omittedLines} 行已折叠</span>}
        {excerpt.lines.map((line, index) => (
          <span key={`${index}:${line}`}>{line || '\u00a0'}</span>
        ))}
        {excerpt.truncated && <span className='tool-output-omitted'>输出预览已截断</span>}
      </code>
    </section>
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

function WorkingDirectory({ presentation }: { presentation: ToolInvocationPresentation }) {
  return (
    <footer>
      <FolderOpen size={11} />
      <span>运行目录</span>
      <code>{presentation.cwd}</code>
    </footer>
  );
}
