import { codeApi } from '../../lib/api';
import type { WorkspaceEntry } from '../../types/api';
import { importWorkFile } from './work-file-io';
import { workFileExtension, workFileMimeType } from './work-local-files';
import type { WorkArtifact } from './work-types';

const maximumTextPreviewBytes = 2 * 1024 * 1024;
const maximumBinaryPreviewBytes = 50 * 1024 * 1024;

const officePreviewExtensions = new Set(['docx', 'xlsx', 'xls', 'ods', 'csv', 'pptx']);
const imagePreviewExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif']);
const textPreviewExtensions = new Set([
  'txt',
  'md',
  'markdown',
  'html',
  'htm',
  'json',
  'xml',
  'svg',
  'yaml',
  'yml',
  'toml',
  'acl',
  'log',
  'css',
  'scss',
  'js',
  'jsx',
  'ts',
  'tsx',
  'rs',
  'py',
  'sh',
]);

export interface WorkQuickLookApi {
  readFile: (path: string) => Promise<{ content: string }>;
  readBinaryFile: (path: string) => Promise<Uint8Array>;
}

export type WorkQuickLookContent =
  | { kind: 'directory' }
  | { kind: 'text'; text: string }
  | { kind: 'image'; blob: Blob }
  | { kind: 'pdf'; blob: Blob }
  | { kind: 'artifact'; artifact: WorkArtifact }
  | { kind: 'unsupported'; reason: string };

export async function loadWorkQuickLook(
  entry: WorkspaceEntry,
  api: WorkQuickLookApi = codeApi
): Promise<WorkQuickLookContent> {
  if (entry.isDirectory) return { kind: 'directory' };
  if (!entry.isFile) return { kind: 'unsupported', reason: '这个项目不是可预览的文件。' };

  const extension = workFileExtension(entry.path);
  if (officePreviewExtensions.has(extension)) {
    if (entry.size > maximumBinaryPreviewBytes) return binarySizeLimit();
    const bytes = await api.readBinaryFile(entry.path);
    const data = binaryArrayBuffer(bytes);
    const file = new File([data], entry.name, { type: workFileMimeType(entry.path) });
    return { kind: 'artifact', artifact: await importWorkFile(file) };
  }
  if (extension === 'pdf') {
    if (entry.size > maximumBinaryPreviewBytes) return binarySizeLimit();
    const bytes = await api.readBinaryFile(entry.path);
    return { kind: 'pdf', blob: new Blob([binaryArrayBuffer(bytes)], { type: workFileMimeType(entry.path) }) };
  }
  if (imagePreviewExtensions.has(extension)) {
    if (entry.size > maximumBinaryPreviewBytes) return binarySizeLimit();
    const bytes = await api.readBinaryFile(entry.path);
    return { kind: 'image', blob: new Blob([binaryArrayBuffer(bytes)], { type: workFileMimeType(entry.path) }) };
  }
  if (!entry.isBinary || textPreviewExtensions.has(extension)) {
    if (entry.size > maximumTextPreviewBytes) {
      return {
        kind: 'unsupported',
        reason: '文本文件超过 2 MB，无法快速查看。',
      };
    }
    const result = await api.readFile(entry.path);
    return { kind: 'text', text: result.content };
  }
  return {
    kind: 'unsupported',
    reason: '当前格式没有安全的内置预览器；仍可将文件作为上下文交给 AI 助手。',
  };
}

function binarySizeLimit(): WorkQuickLookContent {
  return {
    kind: 'unsupported',
    reason: '文件超过 50 MB，无法快速查看。',
  };
}

function binaryArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
