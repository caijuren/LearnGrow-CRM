import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function Empty({ title = '暂无数据', description, action, icon }: Props) {
  return (
    <div className="empty-state py-16 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mb-5 border border-slate-200/60 shadow-sm relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/50 to-transparent" />
        <div className="relative">{icon || <Inbox className="w-9 h-9 text-slate-300" />}</div>
      </div>
      <p className="text-base font-semibold text-slate-500 mb-1.5">{title}</p>
      {description && <p className="text-sm text-slate-400 mb-5 max-w-sm text-center leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
