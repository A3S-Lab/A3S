import { codeApi } from '../../lib/api';
import { createWorkArtifactBlob } from './work-file-io';
import { fileNameWithoutExtension } from './work-file-download';
import {
  type WorkLocalFileBinding,
  type WorkLocalFileSnapshot,
  writeWorkLocalFileAtomically,
} from './work-local-file-binding';
import { joinLocalPath } from './work-local-files';
import { purgeWorkArtifact, saveWorkArtifact } from './work-repository';
import { createWorkArtifact } from './work-templates';
import { type WorkArtifact, type WorkArtifactKind, workArtifactExtension } from './work-types';

export interface WorkLocalArtifactCreateDependencies {
  createArtifact: (templateId: string) => WorkArtifact;
  createBlob: (artifact: WorkArtifact) => Promise<Blob>;
  saveArtifact: (artifact: WorkArtifact) => Promise<WorkArtifact>;
  purgeArtifact: (id: string) => Promise<void>;
  writeFile: (path: string, bytes: Uint8Array) => Promise<WorkLocalFileSnapshot>;
}

export interface WorkLocalArtifactCreateResult {
  artifact: WorkArtifact;
  binding: WorkLocalFileBinding;
}

const defaultDependencies: WorkLocalArtifactCreateDependencies = {
  createArtifact: createWorkArtifact,
  createBlob: createWorkArtifactBlob,
  saveArtifact: saveWorkArtifact,
  purgeArtifact: purgeWorkArtifact,
  writeFile: (path, bytes) => writeWorkLocalFileAtomically(codeApi, path, bytes),
};

export async function createWorkLocalArtifact(
  templateId: string,
  directory: string,
  requestedName: string,
  dependencies: WorkLocalArtifactCreateDependencies = defaultDependencies
): Promise<WorkLocalArtifactCreateResult> {
  const draft = dependencies.createArtifact(templateId);
  if (draft.kind === 'pdf') throw new Error('PDF 需要从现有文件导入，当前不能直接新建空白 PDF。');

  const fileName = workLocalArtifactFileName(requestedName, draft.kind);
  const path = joinLocalPath(directory, fileName);
  draft.title = fileNameWithoutExtension(fileName);

  const blob = await dependencies.createBlob(draft);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const artifact = await dependencies.saveArtifact(draft);

  try {
    const snapshot = await dependencies.writeFile(path, bytes);
    return {
      artifact,
      binding: {
        artifactId: artifact.id,
        path,
        ...snapshot,
        updatedAt: Date.now(),
      },
    };
  } catch (error) {
    try {
      await dependencies.purgeArtifact(artifact.id);
    } catch {
      // Preserve the local write failure; it is the actionable error for the user.
    }
    throw error;
  }
}

export function workLocalArtifactFileName(requestedName: string, kind: WorkArtifactKind): string {
  const value = requestedName.trim();
  if (!value || value === '.' || value === '..' || /[<>:"/\\|?*\u0000-\u001f]/.test(value)) {
    throw new Error('请输入有效的文件名。');
  }
  const extension = workArtifactExtension(kind);
  const suffix = value.match(/\.([^.]+)$/)?.[1]?.toLocaleLowerCase();
  if (suffix && suffix !== extension) {
    throw new Error(`当前文件必须保存为 .${extension}。`);
  }
  return suffix ? value : `${value}.${extension}`;
}
