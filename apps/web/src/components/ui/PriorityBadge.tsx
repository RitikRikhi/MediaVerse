import React from 'react';
import { PriorityLevel } from '../../types';

interface PriorityBadgeProps {
  priority: PriorityLevel;
}

const priorityConfig: Record<PriorityLevel, { label: string; style: string }> = {
  LOW: { label: 'Low', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  MEDIUM: { label: 'Medium', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  HIGH: { label: 'High', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  CRITICAL: { label: 'Critical', style: 'bg-red-50 text-red-700 border-red-300 font-bold' }
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const config = priorityConfig[priority] || priorityConfig.MEDIUM;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${config.style}`}>
      {config.label}
    </span>
  );
};
