import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusBadgeProps {
  status: 'scheduled' | 'active' | 'ended' | 'online' | 'offline' | 'busy' | 'in_meeting' | 'pending' | 'accepted';
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const configs: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    scheduled: {
      label: 'Scheduled',
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-700',
      dot: 'bg-blue-500',
    },
    active: {
      label: 'Live Now',
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700 animate-pulse',
      dot: 'bg-emerald-500',
    },
    ended: {
      label: 'Ended',
      bg: 'bg-slate-100 border-slate-200',
      text: 'text-slate-600',
      dot: 'bg-slate-400',
    },
    online: {
      label: 'Online',
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
    offline: {
      label: 'Offline',
      bg: 'bg-slate-100 border-slate-200',
      text: 'text-slate-500',
      dot: 'bg-slate-400',
    },
    busy: {
      label: 'Busy',
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      dot: 'bg-red-500',
    },
    in_meeting: {
      label: 'In Meeting',
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
    },
    pending: {
      label: 'Pending',
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
    },
    accepted: {
      label: 'Accepted',
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
    },
  };

  const conf = configs[status] || configs.scheduled;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border select-none',
        conf.bg,
        conf.text,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', conf.dot)} />
      {conf.label}
    </span>
  );
}
