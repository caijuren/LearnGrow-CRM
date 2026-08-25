import React from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg';

const avatarColors = [
  'bg-[#5B5CE2]',
  'bg-[#2E90FA]',
  'bg-[#12B76A]',
  'bg-[#F79009]',
  'bg-[#F04438]',
  'bg-[#9E77ED]',
  'bg-[#06B6D4]',
  'bg-[#EA580C]',
];

const getColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

interface AvatarProps {
  name?: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = '',
  src,
  size = 'md',
  className = '',
}) => {
  const sizeClass = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
  }[size];

  const initial = name.charAt(0).toUpperCase();

  if (src) {
    return (
      <div className={`avatar ${sizeClass} ${className} overflow-hidden bg-bg-subtle`}>
        <img src={src} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  const colorClass = getColor(name || 'U');

  return (
    <div className={`avatar ${sizeClass} ${colorClass} ${className}`}>
      {initial || 'U'}
    </div>
  );
};

export default Avatar;
