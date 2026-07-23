import { Plus, X } from 'lucide-react';
import { Button, IconButton } from '../../../../design-system/primitives';

export function KeyValueEditor({
  value,
  onChange,
  label,
  keyPlaceholder = '名称',
  valuePlaceholder = '值',
}: {
  value: Readonly<Record<string, string>>;
  onChange(value: Record<string, string>): void;
  label: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const entries = Object.entries(value);
  const updateKey = (previous: string, next: string) => {
    const updated = { ...value };
    const current = updated[previous] ?? '';
    delete updated[previous];
    updated[next] = current;
    onChange(updated);
  };
  return (
    <fieldset className='key-value-editor'>
      <legend className='config-visually-hidden'>{label}</legend>
      {entries.map(([key, itemValue], index) => (
        <div className='key-value-row' key={`${key}-${index}`}>
          <input
            className='config-input'
            value={key}
            aria-label={`${label}名称 ${index + 1}`}
            placeholder={keyPlaceholder}
            onChange={(event) => updateKey(key, event.target.value)}
          />
          <input
            className='config-input'
            value={itemValue}
            aria-label={`${label}值 ${index + 1}`}
            placeholder={valuePlaceholder}
            onChange={(event) => onChange({ ...value, [key]: event.target.value })}
          />
          <IconButton
            label={`删除${label} ${key || index + 1}`}
            onClick={() => {
              const updated = { ...value };
              delete updated[key];
              onChange(updated);
            }}
          >
            <X size={13} />
          </IconButton>
        </div>
      ))}
      <Button
        tone='quiet'
        className='key-value-add'
        onClick={() => {
          let key = 'NEW_KEY';
          let suffix = 2;
          while (key in value) key = `NEW_KEY_${suffix++}`;
          onChange({ ...value, [key]: '' });
        }}
      >
        <Plus size={13} /> 添加一项
      </Button>
    </fieldset>
  );
}
