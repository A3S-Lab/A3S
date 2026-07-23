import { cloneElement, type ReactElement, type ReactNode, useId } from 'react';

export type FieldControlProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean | undefined;
  'aria-required': boolean | undefined;
};

type FieldControlElementProps = Partial<FieldControlProps> & {
  id?: string;
};

export function Field({
  label,
  description,
  error,
  required = false,
  children,
  className = '',
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactElement<FieldControlElementProps> | ((props: FieldControlProps) => ReactNode);
  className?: string;
}) {
  const generatedId = useId();
  const element = typeof children === 'function' ? null : children;
  const controlId = element?.props.id ?? `${generatedId}-control`;
  const descriptionId = description ? `${generatedId}-description` : undefined;
  const errorId = error ? `${generatedId}-error` : undefined;
  const inheritedDescription = element?.props['aria-describedby'];
  const describedBy = [inheritedDescription, descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const controlProps: FieldControlProps = {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : element?.props['aria-invalid'],
    'aria-required': required ? true : element?.props['aria-required'],
  };

  return (
    <div className={`ds-field${error ? ' invalid' : ''}${className ? ` ${className}` : ''}`}>
      <label className='ds-field-label' htmlFor={controlId}>
        {label}
        {required && <span aria-hidden='true'> *</span>}
      </label>
      {typeof children === 'function' ? children(controlProps) : cloneElement(children, controlProps)}
      {description && (
        <small className='ds-field-description' id={descriptionId}>
          {description}
        </small>
      )}
      {error && (
        <small className='ds-field-error' id={errorId} role='alert'>
          {error}
        </small>
      )}
    </div>
  );
}
