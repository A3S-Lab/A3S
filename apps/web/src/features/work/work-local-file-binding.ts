import {
  joinLocalPath,
  localPathBasename,
  localPathInside,
  relativeLocalPath,
  sameLocalPath,
  siblingLocalPath,
} from './work-local-files';

const localFileBindingsKey = 'a3s-work.local-file-bindings.v1';

export interface WorkLocalFileBinding {
  artifactId: string;
  path: string;
  fingerprint: string;
  size: number;
  updatedAt: number;
}

export interface WorkLocalFileSnapshot {
  fingerprint: string;
  size: number;
}

export interface WorkLocalFileApi {
  readBinaryFile: (path: string) => Promise<Uint8Array>;
  writeBinaryFile: (path: string, data: Uint8Array) => Promise<{ success: boolean }>;
  renamePath: (source: string, destination: string) => Promise<{ success: boolean }>;
  deletePath: (path: string) => Promise<{ success: boolean }>;
  pathExists: (path: string) => Promise<{ exists: boolean }>;
}

export class WorkLocalFileConflictError extends Error {
  readonly expectedFingerprint: string;
  readonly actualFingerprint: string | null;

  constructor(expectedFingerprint: string, actualFingerprint: string | null) {
    super(
      actualFingerprint
        ? 'The local file changed outside A3S Work.'
        : 'The local file is no longer available at its saved path.'
    );
    this.name = 'WorkLocalFileConflictError';
    this.expectedFingerprint = expectedFingerprint;
    this.actualFingerprint = actualFingerprint;
  }
}

export class WorkLocalFileExistsError extends Error {
  readonly path: string;

  constructor(path: string) {
    super('A file already exists at the selected path.');
    this.name = 'WorkLocalFileExistsError';
    this.path = path;
  }
}

export class WorkLocalFileVerificationError extends Error {
  constructor() {
    super('The local file could not be verified after saving.');
    this.name = 'WorkLocalFileVerificationError';
  }
}

export function readWorkLocalFileBinding(artifactId: string): WorkLocalFileBinding | null {
  return readBindings()[artifactId] ?? null;
}

export function readWorkLocalFileBindingByPath(path: string): WorkLocalFileBinding | null {
  return (
    Object.values(readBindings())
      .filter((binding) => sameLocalPath(binding.path, path))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
  );
}

export function saveWorkLocalFileBinding(binding: WorkLocalFileBinding): void {
  const bindings = readBindings();
  for (const [artifactId, existing] of Object.entries(bindings)) {
    if (artifactId !== binding.artifactId && sameLocalPath(existing.path, binding.path)) delete bindings[artifactId];
  }
  bindings[binding.artifactId] = { ...binding };
  writeBindings(bindings);
}

export function removeWorkLocalFileBinding(artifactId: string): void {
  const bindings = readBindings();
  if (!bindings[artifactId]) return;
  delete bindings[artifactId];
  writeBindings(bindings);
}

export function moveWorkLocalFileBindings(sourcePath: string, destinationPath: string): number {
  const bindings = readBindings();
  let moved = 0;
  for (const [artifactId, binding] of Object.entries(bindings)) {
    if (!localPathInside(sourcePath, binding.path)) continue;
    const relativePath = relativeLocalPath(binding.path, sourcePath);
    const path = sameLocalPath(binding.path, sourcePath)
      ? destinationPath
      : joinLocalPath(destinationPath, restoreRelativePathStyle(relativePath, destinationPath));
    bindings[artifactId] = { ...binding, path };
    moved += 1;
  }
  if (moved) writeBindings(bindings);
  return moved;
}

export function removeWorkLocalFileBindingsAtPath(path: string): number {
  const bindings = readBindings();
  let removed = 0;
  for (const [artifactId, binding] of Object.entries(bindings)) {
    if (!localPathInside(path, binding.path)) continue;
    delete bindings[artifactId];
    removed += 1;
  }
  if (removed) writeBindings(bindings);
  return removed;
}

export async function fingerprintWorkFile(bytes: Uint8Array): Promise<string> {
  const source = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', source);
    return `sha256:${Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')}`;
  }
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}:${bytes.byteLength}`;
}

export async function writeWorkLocalFileAtomically(
  api: WorkLocalFileApi,
  path: string,
  bytes: Uint8Array,
  options: {
    expectedFingerprint?: string;
    allowOverwrite?: boolean;
  } = {}
): Promise<WorkLocalFileSnapshot> {
  if (options.expectedFingerprint) {
    if (!(await api.pathExists(path)).exists) {
      throw new WorkLocalFileConflictError(options.expectedFingerprint, null);
    }
    const currentFingerprint = await fingerprintWorkFile(await api.readBinaryFile(path));
    if (currentFingerprint !== options.expectedFingerprint) {
      throw new WorkLocalFileConflictError(options.expectedFingerprint, currentFingerprint);
    }
  } else if (!options.allowOverwrite && (await api.pathExists(path)).exists) {
    throw new WorkLocalFileExistsError(path);
  }

  const temporaryPath = workTemporaryFilePath(path);
  let temporaryCreated = false;
  try {
    await api.writeBinaryFile(temporaryPath, bytes);
    temporaryCreated = true;
    await api.renamePath(temporaryPath, path);
    temporaryCreated = false;
    const expectedOutputFingerprint = await fingerprintWorkFile(bytes);
    const savedBytes = await api.readBinaryFile(path);
    const actualOutputFingerprint = await fingerprintWorkFile(savedBytes);
    if (actualOutputFingerprint !== expectedOutputFingerprint) throw new WorkLocalFileVerificationError();
    return {
      fingerprint: expectedOutputFingerprint,
      size: bytes.byteLength,
    };
  } catch (error) {
    if (temporaryCreated) {
      try {
        await api.deletePath(temporaryPath);
      } catch {
        // Preserve the original save error; an orphaned hidden temporary file is safer than data loss.
      }
    }
    throw error;
  }
}

function readBindings(): Record<string, WorkLocalFileBinding> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(localFileBindingsKey) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, WorkLocalFileBinding] => entry[0] === entry[1]?.artifactId && isBinding(entry[1])
      )
    );
  } catch {
    return {};
  }
}

function writeBindings(bindings: Record<string, WorkLocalFileBinding>): void {
  try {
    localStorage.setItem(localFileBindingsKey, JSON.stringify(bindings));
  } catch {
    // The managed Work artifact remains available when browser preferences cannot be persisted.
  }
}

function isBinding(value: unknown): value is WorkLocalFileBinding {
  if (!value || typeof value !== 'object') return false;
  const binding = value as Partial<WorkLocalFileBinding>;
  return (
    typeof binding.artifactId === 'string' &&
    Boolean(binding.artifactId) &&
    typeof binding.path === 'string' &&
    Boolean(binding.path) &&
    typeof binding.fingerprint === 'string' &&
    Boolean(binding.fingerprint) &&
    typeof binding.size === 'number' &&
    Number.isFinite(binding.size) &&
    binding.size >= 0 &&
    typeof binding.updatedAt === 'number' &&
    Number.isFinite(binding.updatedAt)
  );
}

function workTemporaryFilePath(path: string): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return siblingLocalPath(path, `.${localPathBasename(path)}.a3s-${id}.tmp`);
}

function restoreRelativePathStyle(path: string, reference: string): string {
  return reference.includes('\\') && !reference.includes('/') ? path.replace(/\//g, '\\') : path.replace(/\\/g, '/');
}
