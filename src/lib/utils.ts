import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function wxDisplayName(u: {
  display_name?: string | null;
  name?: string | null;
  nickname?: string | null;
  child_name?: string | null;
}): string {
  return u.display_name || u.name || u.nickname || (u.child_name ? `${u.child_name}家长` : '') || '微信用户';
}
