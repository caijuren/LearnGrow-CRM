import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ButtonSize = 'md' | 'sm';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  block?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  block,
  className = '',
  children,
  disabled,
  ...rest
}) => {
  const sizeClass = size === 'sm' ? 'btn-sm' : '';
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    tertiary: 'btn-tertiary',
    danger: 'btn-danger',
  }[variant];

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${block ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <svg className="animate-spin -ml-0.5 w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && icon}
      {children}
    </button>
  );
};

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'md' | 'sm';
  icon: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  size = 'md',
  icon,
  className = '',
  ...rest
}) => {
  const sizeClass = size === 'sm' ? 'btn-icon-sm' : 'btn-icon';
  return (
    <button className={`${sizeClass} ${className}`} {...rest}>
      {icon}
    </button>
  );
};

export default Button;
