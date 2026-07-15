import { Braces, File, FileCode2, FileImage, FileText, Folder, FolderOpen } from 'lucide-react';

export function WorkspaceEntryIcon({
  name,
  extension,
  isDirectory,
  expanded = false,
  size = 16,
}: {
  name: string;
  extension?: string | null;
  isDirectory: boolean;
  expanded?: boolean;
  size?: number;
}) {
  const tone = workspaceEntryIconTone(name, extension, isDirectory);
  if (isDirectory) {
    const Icon = expanded ? FolderOpen : Folder;
    return <Icon className={`workspace-entry-icon ${tone}`} size={size} aria-hidden='true' />;
  }
  const Icon = workspaceEntryGlyph(tone);
  return <Icon className={`workspace-entry-icon ${tone}`} size={size} aria-hidden='true' />;
}

export function workspaceEntryIconTone(name: string, extension: string | null | undefined, isDirectory: boolean) {
  if (isDirectory) return 'folder';
  const ext = (extension || name.split('.').pop() || '').toLowerCase();
  if (['ts', 'tsx'].includes(ext)) return 'typescript';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (['json', 'jsonc'].includes(ext)) return 'json';
  if (['md', 'mdx', 'txt', 'rst'].includes(ext)) return 'document';
  if (['css', 'scss', 'sass', 'less'].includes(ext)) return 'style';
  if (['html', 'htm', 'vue', 'svelte'].includes(ext)) return 'markup';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return 'image';
  if (ext === 'rs') return 'rust';
  if (['py', 'pyi'].includes(ext)) return 'python';
  if (['yaml', 'yml', 'toml', 'hcl', 'acl', 'env', 'ini', 'conf'].includes(ext)) return 'config';
  if (['lock', 'lockb'].includes(ext) || name.toLowerCase().includes('lock')) return 'lock';
  return 'default';
}

function workspaceEntryGlyph(tone: string) {
  if (tone === 'json') return Braces;
  if (tone === 'image') return FileImage;
  if (['document', 'config', 'lock'].includes(tone)) return FileText;
  if (['typescript', 'javascript', 'style', 'markup', 'rust', 'python'].includes(tone)) return FileCode2;
  return File;
}
