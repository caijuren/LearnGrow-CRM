import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusProps {
  variant?: StatusVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export const Status: React.FC<StatusProps> = ({
  variant = 'neutral',
  children,
  dot = true,
  className = '',
}) => {
  const dotColor = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    neutral: 'bg-text-tertiary',
  }[variant];

  const textColor = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    info: 'text-info',
    neutral: 'text-text-secondary',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${textColor} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
      )}
      {children}
    </span>
  );
};

export default Status;
