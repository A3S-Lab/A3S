import {
  Braces,
  Database,
  File,
  FileArchive,
  FileCode2,
  FileCog,
  FileJson2,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Palette,
  TerminalSquare,
} from 'lucide-react';

export function WorkspaceFileIcon({
  path,
  directory = false,
  expanded = false,
  size = 14,
}: {
  path: string;
  directory?: boolean;
  expanded?: boolean;
  size?: number;
}) {
  if (directory) {
    return expanded ? (
      <FolderOpen className='workspace-file-icon folder' size={size} />
    ) : (
      <Folder className='workspace-file-icon folder' size={size} />
    );
  }

  const extension = path.split('.').pop()?.toLowerCase();
  const props = { className: `workspace-file-icon ${fileIconTone(extension)}`, size };
  if (extension === 'ts' || extension === 'tsx') return <Braces {...props} />;
  if (extension === 'js' || extension === 'jsx') return <FileCode2 {...props} />;
  if (extension === 'json' || extension === 'jsonc') return <FileJson2 {...props} />;
  if (extension === 'rs' || extension === 'toml' || extension === 'hcl' || extension === 'acl')
    return <FileCog {...props} />;
  if (extension === 'css' || extension === 'scss' || extension === 'less') return <Palette {...props} />;
  if (extension === 'md' || extension === 'mdx' || extension === 'txt') return <FileText {...props} />;
  if (extension === 'sh' || extension === 'bash' || extension === 'zsh') return <TerminalSquare {...props} />;
  if (extension === 'sql' || extension === 'db' || extension === 'sqlite') return <Database {...props} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(extension ?? '')) return <Image {...props} />;
  if (['zip', 'tar', 'gz', '7z', 'rar'].includes(extension ?? '')) return <FileArchive {...props} />;
  return <File {...props} />;
}

function fileIconTone(extension?: string): string {
  if (extension === 'ts' || extension === 'tsx') return 'typescript';
  if (extension === 'js' || extension === 'jsx') return 'javascript';
  if (extension === 'rs') return 'rust';
  if (extension === 'json' || extension === 'jsonc') return 'json';
  if (extension === 'css' || extension === 'scss' || extension === 'less') return 'css';
  if (extension === 'md' || extension === 'mdx') return 'markdown';
  if (extension === 'sh' || extension === 'bash' || extension === 'zsh') return 'shell';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(extension ?? '')) return 'image';
  if (extension === 'py') return 'python';
  if (extension === 'go') return 'go';
  return 'default';
}
