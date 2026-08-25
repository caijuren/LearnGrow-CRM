import React from 'react';

export type TabVariant = 'default' | 'pills';

interface TabItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: TabVariant;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onChange,
  variant = 'default',
  className = '',
}) => {
  if (variant === 'pills') {
    return (
      <div className={`tab-list ${className}`}>
        {items.map((item) => (
          <div
            key={item.key}
            className={`tab-item ${activeKey === item.key ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={() => !item.disabled && onChange(item.key)}
          >
            {item.icon}
            {item.label}
          </div>
        ))}
      </div>
    );
  }

  // default: 底边线样式
  return (
    <div className={`flex items-center gap-1 border-b border-border-subtle ${className}`}>
      {items.map((item) => {
        const isActive = activeKey === item.key;
        return (
          <button
            key={item.key}
            className={`relative px-4 py-3 text-sm font-medium transition-colors duration-150 ease-out
                        ${isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}
                        ${item.disabled ? 'text-text-disabled cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => !item.disabled && onChange(item.key)}
            disabled={item.disabled}
          >
            <span className="flex items-center gap-1.5">
              {item.icon}
              {item.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
