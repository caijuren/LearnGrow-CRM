import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}

export const Empty: React.FC<EmptyProps> = ({
  title = '暂无数据',
  description,
  icon,
  action,
  compact = false,
}) => {
  return (
    <div className={`empty-state ${compact ? 'py-10' : 'py-16'}`}>
      <div className="w-10 h-10 rounded-md bg-bg-subtle flex items-center justify-center text-text-tertiary mb-3">
        {icon || <Inbox size={18} strokeWidth={1.5} />}
      </div>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && (
        <p className="text-xs text-text-tertiary mt-1 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default Empty;
