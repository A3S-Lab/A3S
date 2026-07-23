import { workFileExtension } from '../work-local-files';

type WorkFileIconKind =
  | 'folder'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'pdf'
  | 'text'
  | 'image'
  | 'archive'
  | 'code'
  | 'default';

export function WorkFileIcon({
  path,
  directory = false,
  open = false,
  size = 18,
}: {
  path: string;
  directory?: boolean;
  open?: boolean;
  size?: number;
}) {
  const extension = workFileExtension(path);
  const kind = directory ? 'folder' : workFileIconKind(extension);
  return (
    <span
      aria-hidden='true'
      className={`work-local-file-icon ${kind}`}
      data-compact={size < 24 || undefined}
      data-open={directory && open ? 'true' : undefined}
      style={{ width: size, height: size }}
    >
      {directory ? <FolderGlyph open={open} /> : <FileGlyph extension={extension} kind={kind} />}
    </span>
  );
}

function FolderGlyph({ open }: { open: boolean }) {
  return (
    <svg viewBox='0 0 48 48' focusable='false'>
      <path className='work-folder-back' d='M5.5 12.5a4 4 0 0 1 4-4h10.2l4.5 4.6h14.3a4 4 0 0 1 4 4v19.4h-37z' />
      <path className='work-folder-tab' d='M7.3 11.8a2.2 2.2 0 0 1 2.2-2.2h9.8l4.1 4.2H7.3z' />
      {open ? (
        <path
          className='work-folder-front'
          d='M6.1 21.3a3.5 3.5 0 0 1 3.4-2.8h30.9a2.4 2.4 0 0 1 2.3 3.1l-4.8 15.1a3.6 3.6 0 0 1-3.4 2.5H8.9a3.1 3.1 0 0 1-3-3.9z'
        />
      ) : (
        <path className='work-folder-front' d='M5.5 17.1h37v18.4a4 4 0 0 1-4 4h-29a4 4 0 0 1-4-4z' />
      )}
      <path className='work-folder-highlight' d={open ? 'M10.2 21.6h28.7' : 'M9.5 20.2h29'} />
    </svg>
  );
}

function FileGlyph({ extension, kind }: { extension: string; kind: WorkFileIconKind }) {
  return (
    <svg viewBox='0 0 48 48' focusable='false'>
      <path
        className='work-file-sheet'
        d='M10 4.5h18.3L38 14.2v25.3a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-31a4 4 0 0 1 4-4z'
      />
      <path className='work-file-fold' d='M28.3 4.5v7.1a2.6 2.6 0 0 0 2.6 2.6H38z' />
      <path className='work-file-accent' d='M6 8.5a4 4 0 0 1 4-4h3.5v39H10a4 4 0 0 1-4-4z' />
      <FileSymbol extension={extension} kind={kind} />
    </svg>
  );
}

function FileSymbol({ extension, kind }: { extension: string; kind: WorkFileIconKind }) {
  if (kind === 'image') {
    return (
      <g className='work-file-symbol work-file-image-symbol'>
        <circle cx='29.8' cy='22.1' r='2.5' />
        <path d='m17.2 35 6.1-7.2 4.3 4 3.4-3.4 5.1 6.6z' />
      </g>
    );
  }
  if (kind === 'archive') {
    return (
      <g className='work-file-symbol work-file-archive-symbol'>
        <path d='M23 17h5v4h-5zm0 5h5v4h-5zm0 5h5v4h-5zm0 5h5v4h-5z' />
        <path d='M28 17h5v4h-5zm0 5h5v4h-5zm0 5h5v4h-5zm0 5h5v4h-5z' />
      </g>
    );
  }
  if (kind === 'code') {
    return (
      <g className='work-file-symbol work-file-code-symbol'>
        <path d='m22.5 23-4.5 4 4.5 4M31.5 23l4.5 4-4.5 4M28.8 20.5l-3.6 13' />
      </g>
    );
  }
  if (kind === 'default' || kind === 'text') {
    return (
      <g className='work-file-symbol work-file-lines-symbol'>
        <path d='M18.5 21.5h14M18.5 27h14M18.5 32.5h9.5' />
      </g>
    );
  }
  return (
    <text className='work-file-monogram' x='25.7' y='32.7' textAnchor='middle'>
      {fileMonogram(extension, kind)}
    </text>
  );
}

function workFileIconKind(extension: string): WorkFileIconKind {
  if (['doc', 'docx'].includes(extension)) return 'document';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return 'spreadsheet';
  if (['ppt', 'pptx'].includes(extension)) return 'presentation';
  if (extension === 'pdf') return 'pdf';
  if (['md', 'markdown', 'mdx', 'txt', 'rtf'].includes(extension)) return 'text';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(extension)) return 'image';
  if (['zip', '7z', 'rar', 'tar', 'gz'].includes(extension)) return 'archive';
  if (codeExtensions.has(extension)) return 'code';
  return 'default';
}

function fileMonogram(extension: string, kind: WorkFileIconKind): string {
  if (kind === 'document') return 'W';
  if (kind === 'spreadsheet') return 'X';
  if (kind === 'presentation') return 'P';
  if (kind === 'pdf') return 'PDF';
  return extension.slice(0, 3).toLocaleUpperCase() || 'FILE';
}

const codeExtensions = new Set([
  'c',
  'cc',
  'cpp',
  'cs',
  'css',
  'go',
  'h',
  'hpp',
  'html',
  'htm',
  'java',
  'js',
  'jsx',
  'json',
  'kt',
  'kts',
  'lua',
  'php',
  'py',
  'rb',
  'rs',
  'scss',
  'sh',
  'sql',
  'swift',
  'toml',
  'ts',
  'tsx',
  'vue',
  'xml',
  'yaml',
  'yml',
]);
