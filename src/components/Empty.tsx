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
      <div className={`rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-primary-soft via-bg-subtle to-bg-subtle ring-1 ring-inset ring-primary/10 ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}>
        <div className="text-primary/80">
          {icon || <Inbox size={compact ? 20 : 24} strokeWidth={1.5} />}
        </div>
      </div>
      <p className="text-sm font-semibold text-text-primary tracking-tight">{title}</p>
      {description && (
        <p className="text-xs text-text-tertiary mt-1.5 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};

export default Empty;
