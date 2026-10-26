import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Modal } from '../ui/Modal';
import {
  Camera,
  Film,
  Sparkles,
  CheckSquare,
  ClipboardList,
  ShieldCheck,
  Building,
  Target,
  Zap,
  Lightbulb,
  ArrowRight,
  BookOpen,
  Award
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRole?: UserRole;
}

const roleGuides: Record<UserRole, {
  title: string;
  badge: string;
  color: string;
  icon: any;
  summary: string;
  steps: { title: string; desc: string; tip?: string }[];
  proTips: string[];
  shortcut: string;
  shortcutLabel: string;
}> = {
  PHOTOGRAPHER: {
    title: 'Photographer Playbook',
    badge: 'RAW Photos & Burst Capture',
    color: 'emerald',
    icon: Camera,
    summary: 'Check off event shotlists, shoot uncompressed RAW, and upload directly to Google Drive folders.',
    steps: [
      {
        title: '1. Review Assigned Tasks',
        desc: 'Visit "Upload Media" or "Assignments" to see required shots (VIP Arrival, Lamp Lighting, Hackathon).',
        tip: 'Check off shots in real-time as you capture them.'
      },
      {
        title: '2. Shoot High-Speed RAW',
        desc: 'Use uncompressed RAW + 1/250s+ shutter speed for stage speakers and 1/500s+ for active battles.',
        tip: 'Capture crowd reactions right after key moments.'
      },
      {
        title: '3. Stream Directly to Drive',
        desc: 'Open "Upload Media" (/field-crew), select your folder, and drop files. All uploads are stamped with your name.'
      }
    ],
    proTips: [
      'Upload select batches every 60 minutes for live social media stories.',
      'Use the AI Assistant (/ai) to generate creative shot angles on the fly.'
    ],
    shortcut: '/field-crew',
    shortcutLabel: 'Go to Photo Upload'
  },
  VIDEOGRAPHER: {
    title: 'Videographer Playbook',
    badge: '4K Multi-Cam & Stems',
    color: 'blue',
    icon: Film,
    summary: 'Film high-bitrate 4K b-roll and synced stage footage for rapid post-production turnaround.',
    steps: [
      {
        title: '1. Frame Rate Strategy',
        desc: 'Film hero slow-mo moments in 4K 60fps/120fps; film speeches in 4K 24fps/30fps.',
        tip: 'Establish a common clap-sync on camera start.'
      },
      {
        title: '2. Upload Footage Stems',
        desc: 'Upload directly to the Raw Videography folder in Google Drive with descriptive tags.',
        tip: 'Hold every static b-roll shot for at least 6 seconds.'
      },
      {
        title: '3. Hand Off to Editors',
        desc: 'Uploaded clips appear immediately in the Video Editor workspace for editing.'
      }
    ],
    proTips: [
      'Keep your white balance locked for consistent multi-cam color grading.',
      'Capture wide crowd horizons with university banners in frame.'
    ],
    shortcut: '/field-crew',
    shortcutLabel: 'Go to Video Upload'
  },
  VIDEO_EDITOR: {
    title: 'Video Editor Playbook',
    badge: 'Reels, Edits & Delivery',
    color: 'purple',
    icon: Sparkles,
    summary: 'Assemble viral 9:16 reels and cinematic recaps from raw Drive stems and upload cuts directly.',
    steps: [
      {
        title: '1. Access Raw Footage',
        desc: 'Browse raw video stems from Google Drive inside the Editing Studio (/editor).',
        tip: 'Download high-bitrate masters straight from Drive.'
      },
      {
        title: '2. Cut with 3-Second Hook',
        desc: 'Craft an explosive opening hook in the first 3 seconds with music beat-drop sync.'
      },
      {
        title: '3. Direct Cut Upload',
        desc: 'Click "Submit Version Cut", drop your MP4 cut to stream directly to Google Drive.',
        tip: 'Reviewers are instantly notified for QC feedback.'
      }
    ],
    proTips: [
      'Export vertical reels at 1080×1920 60fps with audio normalized to -14 LUFS.',
      'Read timecoded comments from reviewers to submit revised cuts.'
    ],
    shortcut: '/editor',
    shortcutLabel: 'Open Editing Studio'
  },
  REVIEWER: {
    title: 'Reviewer & QC Playbook',
    badge: 'Quality Control & Clearance',
    color: 'rose',
    icon: CheckSquare,
    summary: 'Verify branding, evaluate audio balance, add timecoded revision comments, and clear for broadcast.',
    steps: [
      {
        title: '1. Inspect Pending Cuts',
        desc: 'Open Review & Approval (/reviews) and watch submitted cuts in Google Drive.'
      },
      {
        title: '2. Add Timestamped Notes',
        desc: 'Enter timecode (e.g. 14s) and feedback if revisions are required.'
      },
      {
        title: '3. Clear for Release',
        desc: 'Click "Approve for Release" to clear videos for social media publishing.'
      }
    ],
    proTips: [
      'Verify dignitary name spellings and university logo placement.',
      'Aim for maximum 30-minute review turnaround during festival hours.'
    ],
    shortcut: '/reviews',
    shortcutLabel: 'Open Review Hub'
  },
  MEDIA_COORDINATOR: {
    title: 'Coordinator & Lead Playbook',
    badge: 'Operations & Management',
    color: 'red',
    icon: ClipboardList,
    summary: 'Plan coverage tasks, assign crew members, monitor bottlenecks, and manage Google Drive folders.',
    steps: [
      {
        title: '1. Create Assignments',
        desc: 'Set up coverage tasks with venues, timeframes, and required shot checklists.'
      },
      {
        title: '2. Monitor Live Dashboard',
        desc: 'Watch real-time task status (In Field, In Editing, In Review, Approved).'
      },
      {
        title: '3. Drive & Report Sync',
        desc: 'Manage the 35 Google Drive folders and export CSV reports for leadership.'
      }
    ],
    proTips: [
      'Reallocate photographers dynamically when high-priority bottlenecks arise.',
      'Check Activity Logs (/audit) to monitor live crew velocity.'
    ],
    shortcut: '/assignments',
    shortcutLabel: 'Manage Assignments'
  },
  PRESIDENT: {
    title: 'President & Executive Playbook',
    badge: 'Executive Oversight',
    color: 'amber',
    icon: Building,
    summary: 'Executive dashboard to track university festival milestones and verify coverage transparency.',
    steps: [
      {
        title: '1. Executive Overview',
        desc: 'Check live bird\'s-eye metrics on task completion and media delivery.'
      },
      {
        title: '2. Review Audit Logs',
        desc: 'Inspect tamper-proof activity logs of all crew actions across campus.'
      },
      {
        title: '3. Press-Ready Archives',
        desc: 'Access official Google Drive root archives for institutional PR.'
      }
    ],
    proTips: [
      'Coordinate with PR desk to publish approved photos within 2 hours of ceremonies.'
    ],
    shortcut: '/',
    shortcutLabel: 'Open Dashboard'
  },
  SUPER_ADMIN: {
    title: 'Super Admin Playbook',
    badge: 'Architecture & Security',
    color: 'slate',
    icon: ShieldCheck,
    summary: 'Maintain 99.99% uptime, monitor database sync, and govern enterprise permissions.',
    steps: [
      {
        title: '1. System Health Checks',
        desc: 'Confirm API health, Supabase Cloud PostgreSQL, and Google Drive tokens.'
      },
      {
        title: '2. User Role Governance',
        desc: 'Manage registered crew accounts and test perspectives with dev role switcher.'
      },
      {
        title: '3. Quota & Storage Monitoring',
        desc: 'Ensure 4K video uploads stream properly without memory leaks.'
      }
    ],
    proTips: [
      'Export regular CSV backups of assignments and activity logs.'
    ],
    shortcut: '/drive',
    shortcutLabel: 'Open Drive Settings'
  }
};

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose, initialRole }) => {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(initialRole || user?.roles?.[0] || 'PHOTOGRAPHER');

  const guide = roleGuides[selectedRole] || roleGuides.PHOTOGRAPHER;
  const RoleIcon = guide.icon;

  const roles: { role: UserRole; label: string; icon: any }[] = [
    { role: 'PHOTOGRAPHER', label: 'Photographer', icon: Camera },
    { role: 'VIDEOGRAPHER', label: 'Videographer', icon: Film },
    { role: 'VIDEO_EDITOR', label: 'Video Editor', icon: Sparkles },
    { role: 'REVIEWER', label: 'Reviewer', icon: CheckSquare },
    { role: 'MEDIA_COORDINATOR', label: 'Coordinator', icon: ClipboardList },
    { role: 'SUPER_ADMIN', label: 'Admin', icon: ShieldCheck }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crew Academy & Role Playbook — SAVISKAR 2026"
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Link
            to="/tutorial"
            onClick={onClose}
            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open Full Comprehensive Academy Guide &rarr;</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60"
            >
              Close
            </button>
            <Link
              to={guide.shortcut}
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>{guide.shortcutLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Role Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-slate-100">
          {roles.map(r => {
            const Icon = r.icon;
            const isSelected = selectedRole === r.role;
            return (
              <button
                key={r.role}
                onClick={() => setSelectedRole(r.role)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Hero Role Summary */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-red-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <RoleIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-bold text-slate-900">{guide.title}</h3>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wider">
                {guide.badge}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{guide.summary}</p>
          </div>
        </div>

        {/* 3 Step Workflow */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Core 3-Step Execution Workflow</span>
          </h4>

          <div className="space-y-2">
            {guide.steps.map((s, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-1">
                <h5 className="text-xs font-bold text-slate-900">{s.title}</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed">{s.desc}</p>
                {s.tip && (
                  <p className="text-[10px] text-amber-800 bg-amber-50/70 p-1.5 rounded-lg border border-amber-200/60 font-medium">
                    💡 <strong>Tip:</strong> {s.tip}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pro Tips */}
        <div className="p-3 rounded-xl bg-red-50/50 border border-red-100 space-y-1.5">
          <h5 className="text-xs font-bold text-red-900 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-red-600" />
            <span>Pro Tips for SAVISKAR 2026</span>
          </h5>
          <ul className="space-y-1">
            {guide.proTips.map((tip, idx) => (
              <li key={idx} className="text-[11px] text-red-800 flex items-start gap-1.5">
                <span className="text-red-500 font-bold">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
};
