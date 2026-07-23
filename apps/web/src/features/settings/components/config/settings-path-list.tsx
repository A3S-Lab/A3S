import { Folder, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '../../../../design-system/primitives';

export function SettingsPathList({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: readonly string[];
  onChange(value: string[]): void;
  label: string;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const path = draft.trim();
    if (!path || value.includes(path)) return;
    onChange([...value, path]);
    setDraft('');
  };
  return (
    <fieldset className='settings-path-list'>
      <legend className='config-visually-hidden'>{label}</legend>
      {value.map((path) => (
        <div className='settings-path-item' key={path}>
          <Folder size={13} />
          <code title={path}>{path}</code>
          <IconButton label={`移除 ${path}`} onClick={() => onChange(value.filter((item) => item !== path))}>
            <X size={13} />
          </IconButton>
        </div>
      ))}
      <div className='settings-path-add'>
        <input
          className='config-input'
          value={draft}
          aria-label={`添加${label}`}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <IconButton label={`添加${label}`} disabled={!draft.trim()} onClick={add}>
          <Plus size={14} />
        </IconButton>
      </div>
    </fieldset>
  );
}
