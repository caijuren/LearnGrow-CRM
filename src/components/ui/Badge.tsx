import React from 'react';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  dot = false,
  className = '',
}) => {
  const variantClass = {
    neutral: 'badge-neutral',
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
  }[variant];

  const dotColor = {
    neutral: 'bg-text-tertiary',
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  }[variant];

  return (
    <span className={`badge ${variantClass} ${className}`}>
      {dot && <span className={`status-dot ${dotColor}`} />}
      {children}
    </span>
  );
};

export default Badge;
