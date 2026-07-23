import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const OfficeTextField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: 'text' | 'search' | 'password' }
>(function OfficeTextField({ className = '', type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={`work-office-text-field ${className}`.trim()} {...props} />;
});

export const OfficeTextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function OfficeTextArea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`work-office-text-area ${className}`.trim()} {...props} />;
  }
);

export const OfficeFileInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  function OfficeFileInput({ className = '', ...props }, ref) {
    return <input ref={ref} type='file' className={`work-file-input ${className}`.trim()} {...props} />;
  }
);
