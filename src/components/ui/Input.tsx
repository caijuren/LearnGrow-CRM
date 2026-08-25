import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  error,
  leftIcon,
  rightIcon,
  label,
  hint,
  className = '',
  disabled,
  ...rest
}) => {
  const stateClass = error
    ? 'input-error'
    : disabled
    ? 'input-disabled'
    : '';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {leftIcon}
          </div>
        )}
        <input
          className={`input ${stateClass} ${leftIcon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${className}`}
          disabled={disabled}
          {...rest}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">
            {rightIcon}
          </div>
        )}
      </div>
      {hint && (
        <p className={`mt-1.5 text-xs ${error ? 'text-danger' : 'text-text-tertiary'}`}>
          {hint}
        </p>
      )}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  label?: string;
}

export const Select: React.FC<SelectProps> = ({
  error,
  label,
  className = '',
  children,
  ...rest
}) => {
  const stateClass = error ? 'input-error' : '';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <select className={`select ${stateClass} ${className}`} {...rest}>
        {children}
      </select>
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  label?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  error,
  label,
  className = '',
  ...rest
}) => {
  const stateClass = error ? 'input-error' : '';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <textarea
        className={`w-full border border-border-default rounded-md px-3 py-2
                    text-sm text-text-primary bg-bg-surface
                    focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10
                    transition-all duration-150 ease-out
                    placeholder:text-text-tertiary resize-y min-h-[80px] ${stateClass} ${className}`}
        {...rest}
      />
    </div>
  );
};

export default Input;
