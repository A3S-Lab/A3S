import { FileCode2, Sparkles, X } from 'lucide-react';
import { IconButton } from '../../../design-system/primitives';

export function ComposerResourceChips({
  files,
  skills,
  workspaceRoot,
  onRemoveFile,
  onRemoveSkill,
}: {
  files: readonly string[];
  skills: readonly string[];
  workspaceRoot: string;
  onRemoveFile: (path: string) => void;
  onRemoveSkill: (name: string) => void;
}) {
  if (!files.length && !skills.length) return null;
  return (
    <section className='composer-context-files composer-resource-chips' aria-label='已添加的任务资源'>
      {files.map((path) => {
        const label = relativePath(path, workspaceRoot);
        return (
          <span key={`file:${path}`} title={label}>
            <FileCode2 size={12} />
            <span>{label}</span>
            <IconButton label={`移除上下文 ${label}`} onClick={() => onRemoveFile(path)}>
              <X size={11} />
            </IconButton>
          </span>
        );
      })}
      {skills.map((name) => (
        <span className='skill' key={`skill:${name}`} title={`Skill：${name}`}>
          <Sparkles size={12} />
          <span>/{name}</span>
          <IconButton label={`移除 Skill ${name}`} onClick={() => onRemoveSkill(name)}>
            <X size={11} />
          </IconButton>
        </span>
      ))}
    </section>
  );
}

function relativePath(path: string, root: string) {
  return path.startsWith(root) ? path.slice(root.length).replace(/^[/\\]/, '') : path;
}
