import React from 'react';

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  strong?: boolean;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className = '',
  strong = false,
}) => {
  if (orientation === 'vertical') {
    return (
      <div className={`w-px ${strong ? 'bg-border-default' : 'bg-border-subtle'} h-full ${className}`} />
    );
  }

  return <div className={`${strong ? 'divider-strong' : 'divider'} ${className}`} />;
};

export default Divider;
