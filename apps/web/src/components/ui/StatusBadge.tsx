import React from 'react';
import { AssignmentStatus } from '../../types';

interface StatusBadgeProps {
  status: AssignmentStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<AssignmentStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  ASSIGNED: { label: 'Assigned', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', border: 'border-slate-300' },
  CAPTURING: { label: 'Capturing', bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500 animate-pulse', border: 'border-amber-300' },
  UPLOAD_PENDING: { label: 'Upload Pending', bg: 'bg-orange-50', text: 'text-orange-800', dot: 'bg-orange-500', border: 'border-orange-300' },
  AVAILABLE_FOR_EDITING: { label: 'Ready for Edit', bg: 'bg-purple-50', text: 'text-purple-800', dot: 'bg-purple-500', border: 'border-purple-300' },
  EDITING: { label: 'Editing', bg: 'bg-indigo-50', text: 'text-indigo-800', dot: 'bg-indigo-500 animate-pulse', border: 'border-indigo-300' },
  IN_REVIEW: { label: 'In Review', bg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-500', border: 'border-blue-300' },
  REVISION_REQUIRED: { label: 'Changes Requested', bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', border: 'border-red-300' },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-300' },
  DELIVERED: { label: 'Delivered Final', bg: 'bg-teal-50', text: 'text-teal-800', dot: 'bg-teal-500', border: 'border-teal-300' }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status] || {
    label: status,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-500',
    border: 'border-slate-300'
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
