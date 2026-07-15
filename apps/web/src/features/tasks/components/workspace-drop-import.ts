import { codeApi } from '../../../lib/api';

const MAX_FILES = 500;
const MAX_DIRECTORIES = 500;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const WRITE_CHUNK_BYTES = 256 * 1024;

export interface DroppedWorkspaceFile {
  relativePath: string;
  file: File;
}

export interface DroppedWorkspacePayload {
  files: DroppedWorkspaceFile[];
  directories: string[];
  roots: Array<{ name: string; isDirectory: boolean }>;
}

export interface WorkspaceDropImportResult {
  importedPaths: string[];
  fileCount: number;
  directoryCount: number;
}

export async function importWorkspaceDrop(
  dataTransfer: DataTransfer,
  workspaceRoot: string
): Promise<WorkspaceDropImportResult> {
  return importDroppedWorkspacePayload(await readDroppedWorkspacePayload(dataTransfer), workspaceRoot);
}

export async function importDroppedWorkspacePayload(
  payload: DroppedWorkspacePayload,
  workspaceRoot: string
): Promise<WorkspaceDropImportResult> {
  validatePayload(payload, workspaceRoot);
  const rootMappings = new Map<string, string>();
  const reservedNames = new Set<string>();
  const importedPaths: string[] = [];

  for (const root of payload.roots) {
    const destinationName = await availableRootName(workspaceRoot, root.name, root.isDirectory, reservedNames);
    rootMappings.set(root.name, destinationName);
    reservedNames.add(destinationName.toLocaleLowerCase());
    importedPaths.push(joinPath(workspaceRoot, destinationName));
  }

  const remapPath = (relativePath: string) => {
    const [root, ...tail] = splitRelativePath(relativePath);
    const destinationRoot = rootMappings.get(root);
    if (!destinationRoot) throw new Error(`无法解析拖入路径：${relativePath}`);
    return [destinationRoot, ...tail].join('/');
  };
  const directories = [...payload.directories]
    .map(remapPath)
    .sort((left, right) => pathDepth(left) - pathDepth(right) || left.localeCompare(right));

  try {
    for (const directory of directories) await codeApi.createDirectory(joinPath(workspaceRoot, directory));
    for (const batch of chunk(payload.files, 4)) {
      await Promise.all(
        batch.map(async ({ relativePath, file }) => {
          const bytes = new Uint8Array(await file.arrayBuffer());
          await writeFileInChunks(joinPath(workspaceRoot, remapPath(relativePath)), bytes);
        })
      );
    }
  } catch (error) {
    await Promise.allSettled(importedPaths.map((path) => codeApi.deletePath(path)));
    throw error;
  }

  return {
    importedPaths,
    fileCount: payload.files.length,
    directoryCount: payload.directories.length,
  };
}

async function writeFileInChunks(path: string, bytes: Uint8Array) {
  if (!bytes.length) {
    await codeApi.writeBinaryFile(path, bytes, false);
    return;
  }
  for (let offset = 0; offset < bytes.length; offset += WRITE_CHUNK_BYTES) {
    await codeApi.writeBinaryFile(path, bytes.slice(offset, offset + WRITE_CHUNK_BYTES), offset > 0);
  }
}

async function readDroppedWorkspacePayload(dataTransfer: DataTransfer): Promise<DroppedWorkspacePayload> {
  const files: DroppedWorkspaceFile[] = [];
  const directories = new Set<string>();
  const roots: DroppedWorkspacePayload['roots'] = [];
  const entries = Array.from(dataTransfer.items)
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length) {
    for (const entry of entries) {
      const rootName = safeSegment(entry.name);
      roots.push({ name: rootName, isDirectory: entry.isDirectory });
      await walkEntry(entry, '', files, directories);
    }
  } else {
    for (const file of Array.from(dataTransfer.files)) {
      const relativePath = safeRelativePath(file.webkitRelativePath || file.name);
      files.push({ relativePath, file });
      collectParentDirectories(relativePath, directories);
      const [rootName] = splitRelativePath(relativePath);
      if (!roots.some((root) => root.name === rootName)) {
        roots.push({ name: rootName, isDirectory: relativePath.includes('/') });
      }
    }
  }

  return { files, directories: [...directories], roots };
}

async function walkEntry(
  entry: FileSystemEntry,
  parent: string,
  files: DroppedWorkspaceFile[],
  directories: Set<string>
) {
  const relativePath = safeRelativePath(parent ? `${parent}/${entry.name}` : entry.name);
  if (entry.isFile) {
    files.push({ relativePath, file: await readEntryFile(entry as FileSystemFileEntry) });
    return;
  }
  if (!entry.isDirectory) return;
  directories.add(relativePath);
  const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
  for (const child of children) await walkEntry(child, relativePath, files, directories);
}

async function readDirectoryEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) return entries;
    entries.push(...batch);
  }
}

function readEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function validatePayload(payload: DroppedWorkspacePayload, workspaceRoot: string) {
  if (!workspaceRoot.trim()) throw new Error('当前没有可用的工作区。');
  if (!payload.roots.length || (!payload.files.length && !payload.directories.length)) {
    throw new Error('没有读取到可导入的文件或文件夹。');
  }
  if (payload.files.length > MAX_FILES) throw new Error(`一次最多拖入 ${MAX_FILES} 个文件。`);
  if (payload.directories.length > MAX_DIRECTORIES) throw new Error(`一次最多拖入 ${MAX_DIRECTORIES} 个文件夹。`);
  assertUniquePaths(
    payload.roots.map((root) => root.name),
    '拖入内容包含同名的顶层文件或文件夹，请分开导入。'
  );
  assertUniquePaths(
    [...payload.directories, ...payload.files.map((item) => item.relativePath)],
    '拖入内容包含同名路径，请整理后重试。'
  );
  let totalBytes = 0;
  for (const item of payload.files) {
    safeRelativePath(item.relativePath);
    if (item.file.size > MAX_FILE_BYTES) throw new Error(`文件 ${item.file.name} 超过 16 MB，无法拖入。`);
    totalBytes += item.file.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error('本次拖入内容超过 32 MB，请分批导入。');
  for (const directory of payload.directories) safeRelativePath(directory);
  for (const root of payload.roots) safeSegment(root.name);
}

function assertUniquePaths(paths: readonly string[], message: string) {
  const seen = new Set<string>();
  for (const path of paths) {
    const key = safeRelativePath(path).toLocaleLowerCase();
    if (seen.has(key)) throw new Error(message);
    seen.add(key);
  }
}

async function availableRootName(
  workspaceRoot: string,
  requestedName: string,
  isDirectory: boolean,
  reservedNames: Set<string>
) {
  for (let index = 0; index < 1000; index += 1) {
    const candidate = index === 0 ? requestedName : copyName(requestedName, index, isDirectory);
    if (reservedNames.has(candidate.toLocaleLowerCase())) continue;
    if (!(await codeApi.pathExists(joinPath(workspaceRoot, candidate))).exists) return candidate;
  }
  throw new Error(`无法为 ${requestedName} 分配可用名称。`);
}

function copyName(name: string, index: number, isDirectory: boolean) {
  if (isDirectory) return `${name} (${index})`;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name} (${index})`;
  return `${name.slice(0, dot)} (${index})${name.slice(dot)}`;
}

function collectParentDirectories(relativePath: string, directories: Set<string>) {
  const segments = splitRelativePath(relativePath);
  for (let index = 1; index < segments.length; index += 1) {
    directories.add(segments.slice(0, index).join('/'));
  }
}

function safeRelativePath(path: string) {
  const segments = splitRelativePath(path);
  if (!segments.length) throw new Error('拖入内容包含空路径。');
  return segments.map(safeSegment).join('/');
}

function safeSegment(segment: string) {
  const value = segment.trim();
  if (!value || value === '.' || value === '..' || value.includes('\0')) {
    throw new Error(`拖入内容包含无效路径：${segment}`);
  }
  return value;
}

function splitRelativePath(path: string) {
  return path.replaceAll('\\', '/').split('/').filter(Boolean);
}

function joinPath(parent: string, child: string) {
  const separator = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  return `${parent.replace(/[\\/]$/, '')}${separator}${child.replaceAll('/', separator)}`;
}

function pathDepth(path: string) {
  return splitRelativePath(path).length;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
