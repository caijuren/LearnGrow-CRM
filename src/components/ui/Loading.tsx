import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { spinner: 20, text: 'text-xs' },
  md: { spinner: 28, text: 'text-sm' },
  lg: { spinner: 36, text: 'text-base' },
};

export const Loading: React.FC<LoadingProps> = ({
  text = '加载中...',
  size = 'md',
  className = '',
}) => {
  const cfg = sizeMap[size];
  return (
    <div className={`flex flex-col items-center justify-center text-text-tertiary ${className}`}>
      <Loader2 size={cfg.spinner} strokeWidth={1.8} className="animate-spin text-primary" />
      {text && <p className={`${cfg.text} mt-3`}>{text}</p>}
    </div>
  );
};

export default Loading;
