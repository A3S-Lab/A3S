export function SettingsSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type='button'
      className={`settings-switch ${checked ? 'checked' : ''}`}
      role='switch'
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    >
      <span />
    </button>
  );
}
