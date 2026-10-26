import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import {
  Camera,
  Film,
  Sparkles,
  CheckSquare,
  ClipboardList,
  ShieldCheck,
  Building,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Zap,
  Lightbulb,
  Sliders,
  Target,
  Clock,
  HardDrive,
  FileVideo,
  Award,
  Layers,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface RoleTutorialData {
  role: UserRole;
  title: string;
  badge: string;
  icon: any;
  color: string;
  summary: string;
  mission: string;
  workflow: {
    step: string;
    title: string;
    desc: string;
    tip?: string;
  }[];
  proTips: string[];
  recommendedGear: string[];
  shortcutLink: string;
  shortcutLabel: string;
}

const tutorials: Record<UserRole, RoleTutorialData> = {
  PHOTOGRAPHER: {
    role: 'PHOTOGRAPHER',
    title: 'Photographer Playbook',
    badge: 'Field Crew & Camera Operators',
    icon: Camera,
    color: 'emerald',
    summary: 'Capture crisp, candid, high-resolution festival moments and stream raw imagery straight to Google Drive.',
    mission: 'Deliver stunning, publication-ready photos of VIP arrivals, lamp lighting ceremonies, coding battles, and concert crowds with zero delay.',
    workflow: [
      {
        step: '01',
        title: 'Check Your Assigned Events & Shotlist',
        desc: 'Open "Upload Media" or "Assignments" to see your assigned stage sessions and review the required shot checklist.',
        tip: 'Check off shots in real-time as you capture them so the coordinator knows the coverage is complete.'
      },
      {
        step: '02',
        title: 'Shoot in Dual RAW + High-Speed Burst',
        desc: 'Capture in uncompressed RAW (ARW/CR3/NEF) with continuous autofocus. For stage & speeches, use eye-tracking autofocus.',
        tip: 'Keep shutter speeds at 1/250s minimum for moving speakers, and 1/500s+ for active hackathon and dance sessions.'
      },
      {
        step: '03',
        title: 'Upload Directly to Google Drive',
        desc: 'Open the "Upload Media" portal. Select the matching subfolder (e.g. Day 1 > Photography > Lamp Lighting). Drop your files to start uploading.',
        tip: 'Your name is automatically tagged on all assets. You can upload in batches of 50+ images at once.'
      },
      {
        step: '04',
        title: 'Leverage AI for Creative Angles',
        desc: 'Stuck on creative composition? Open the AI Assistant (/ai) and prompt "Give me 5 unique photo angles for the robotics combat arena".'
      }
    ],
    proTips: [
      'Always shoot the reaction shot right after a speaker punchline or award announcement.',
      'Upload select highlight shots every 60 minutes so the social media team can post live stories.',
      'Ensure your camera clock is synchronized with university local time for accurate chronological sorting in Drive.'
    ],
    recommendedGear: [
      '24-70mm f/2.8 lens for versatile stage & crowd shots',
      '70-200mm f/2.8 for tight facial portraits from balcony',
      'Dual UHS-II SD cards with backup mirroring',
      'Extra fully-charged batteries in your field bag'
    ],
    shortcutLink: '/field-crew',
    shortcutLabel: 'Go to Photo Upload Portal'
  },
  VIDEOGRAPHER: {
    role: 'VIDEOGRAPHER',
    title: 'Videographer Playbook',
    badge: 'Cinematography & Multi-Cam Stems',
    icon: Film,
    color: 'blue',
    summary: 'Capture cinematic 4K multi-cam stems, dynamic gimbal moves, and crystal-clear audio stems for reel editors.',
    mission: 'Film energetic, stabilized 4K footage and b-roll that captures the high-tech excitement and scale of SAVISKAR 2026.',
    workflow: [
      {
        step: '01',
        title: 'Review Assignment Specs & Sync Audio',
        desc: 'Check your stage location and shoot brief on the Assignments page. Ensure camera audio is paired or ambient mic stems are rolling.',
        tip: 'Establish a common clap-sync on camera start for easy timeline alignment by the video editing crew.'
      },
      {
        step: '02',
        title: 'Record High-Frame Rate B-Roll',
        desc: 'Film key hero moments in 4K 60fps or 120fps for buttery smooth slow-motion (e.g. robot collisions, guitar solos, cheering crowds).',
        tip: 'Use standard 4K 24fps / 30fps for keynote addresses to conserve storage space and simplify lip-sync.'
      },
      {
        step: '03',
        title: 'Stream Raw Stems to Official Folders',
        desc: 'Navigate to "Upload Media" (/field-crew). Select the Raw Videography folder (e.g. Day 1 > Raw Videography > Stage 4K Multicam) and drop files.',
        tip: 'Add descriptive tags like "drone, gimbal, 4k, crowd, speech" to help editors search instantly.'
      },
      {
        step: '04',
        title: 'Hand Off Quickly to Editors',
        desc: 'As soon as a morning or evening session wraps, upload footage stems immediately so editors can start timelines while the event is ongoing.'
      }
    ],
    proTips: [
      'Hold every pan and static b-roll shot for at least 6 seconds so editors have handles to cut with.',
      'Capture wide crowd horizons with university banners in frame for impactful recap hooks.',
      'Keep your white balance locked at 5600K for daylight and 4300K for auditorium stage spots.'
    ],
    recommendedGear: [
      '3-axis motorized gimbal for walking b-roll and low-angle track moves',
      'Variable ND filter for outdoor drone and sunlit campus coverage',
      'High-speed USB-C card reader for rapid field ingests',
      'Directional shotgun microphone with deadcat windscreen'
    ],
    shortcutLink: '/field-crew',
    shortcutLabel: 'Go to Video Upload Portal'
  },
  VIDEO_EDITOR: {
    role: 'VIDEO_EDITOR',
    title: 'Video Editor Playbook',
    badge: 'Post-Production Studio',
    icon: Sparkles,
    color: 'purple',
    summary: 'Craft viral 9:16 reels, cinematic recaps, and teasers from raw footage stems stored in Google Drive.',
    mission: 'Transform hours of raw footage into electric, high-tempo stories that drive campus engagement and social media buzz.',
    workflow: [
      {
        step: '01',
        title: 'Access Raw Stems from Drive',
        desc: 'Open "Editing Studio" (/editor). Browse registered clips in the "Raw Footage Stems in Drive" bank on the left sidebar.',
        tip: 'Click "Open in Google Drive" on any clip to download the high-bitrate master straight to your editing drive.'
      },
      {
        step: '02',
        title: 'Create Your Editing Project',
        desc: 'Click "+ New Edit Project". Define your creative brief, aspect ratio (9:16 for Reels/Shorts, 16:9 for YouTube), priority, and deadline.',
        tip: 'Use the AI Assistant (/ai) to generate a complete timeline structure and audio beat-drop edit brief in seconds.'
      },
      {
        step: '03',
        title: 'Assemble with Strong First-3-Seconds Hook',
        desc: 'Structure your edit with a high-energy hook in the opening 3 seconds. Match cuts to the music beat drops and apply SAVISKAR brand colors.',
        tip: 'Normalize audio master to -14 LUFS with dialogue peaking around -6 dB for clean mobile playback.'
      },
      {
        step: '04',
        title: 'Upload Version Directly to Drive',
        desc: 'Export your cut (1080p MP4 H.264) and click "Submit Version Cut". Drag and drop your cut directly into the modal to stream it to Google Drive.',
        tip: 'The file automatically uploads to the In Review Cuts folder and alerts reviewers for immediate QC feedback.'
      }
    ],
    proTips: [
      'Always use large, punchy animated captions and lower-thirds for dignitary names.',
      'Check the reviewer comments section in your project to read timestamped notes (@0:14) and upload v2/v3 revised cuts.',
      'Export vertical reels at 1080×1920 60fps with high bitrate (18–25 Mbps) for crisp Instagram rendering.'
    ],
    recommendedGear: [
      'Premiere Pro, DaVinci Resolve, or Final Cut Pro with SAVISKAR project templates',
      'High-speed external NVMe SSD for fast timeline caching',
      'Quality studio monitor headphones for precise audio balancing'
    ],
    shortcutLink: '/editor',
    shortcutLabel: 'Open Video Editing Studio'
  },
  REVIEWER: {
    role: 'REVIEWER',
    title: 'Reviewer & Approver Playbook',
    badge: 'Quality Control & Approval Hub',
    icon: CheckSquare,
    color: 'rose',
    summary: 'Inspect submitted timeline cuts, provide timecoded revision notes, and grant final broadcast clearance.',
    mission: 'Ensure zero errors in university branding, dignitary designations, audio balance, and visual quality before social media release.',
    workflow: [
      {
        step: '01',
        title: 'Inspect Pending Cuts in Review Hub',
        desc: 'Navigate to "Review & Approval" (/reviews). Review all submitted project iterations (v1, v2, vFinal).',
        tip: 'Click "Watch Cut in Drive" to preview the video in native resolution with full audio fidelity.'
      },
      {
        step: '02',
        title: 'Evaluate QC Standards Checklist',
        desc: 'Verify: 1) Correct spelling of Chancellor/Director names, 2) CGC University logo watermark placement, 3) Music copyright safety, 4) Audio levels (-14 LUFS).',
        tip: 'Check that video aspect ratio matches the intended distribution platform (9:16 for Reels, 16:9 for Website/Recap).'
      },
      {
        step: '03',
        title: 'Submit Timecoded Review Notes',
        desc: 'If revisions are required, enter the timecode (e.g. 14 seconds) and specific guidance (e.g. "Color grade is too green, warm up skin tones").',
        tip: 'Click "Request Revision". The editor is notified immediately and the project stays organized in review state.'
      },
      {
        step: '04',
        title: 'Clear for Social Media Broadcast',
        desc: 'When the cut meets all university standards, click "Approve for Release". The project moves to Approved Deliverables for publishing.'
      }
    ],
    proTips: [
      'Provide clear, actionable feedback rather than vague subjective notes (e.g. specify timecode and exact action).',
      'Aim for maximum 30-minute review turnaround during festival hours so news remains breaking and timely.'
    ],
    recommendedGear: [
      'Calibrated sRGB / Display P3 monitor for accurate color verification',
      'Fast network connection for smooth 4K streaming'
    ],
    shortcutLink: '/reviews',
    shortcutLabel: 'Open Review & Approval Hub'
  },
  MEDIA_COORDINATOR: {
    role: 'MEDIA_COORDINATOR',
    title: 'Media Coordinator & Lead Playbook',
    badge: 'Operations & Assignment Lead',
    icon: ClipboardList,
    color: 'red',
    summary: 'Orchestrate the entire 50-member crew, balance workload, oversee Drive storage, and ensure full festival coverage.',
    mission: 'Run a seamless, zero-bottleneck media production for SAVISKAR 2026 across both festival days.',
    workflow: [
      {
        step: '01',
        title: 'Schedule & Assign Event Tasks',
        desc: 'Go to "Assignments" (/assignments). Click "+ Create Assignment" to set up coverage tasks with venues, timeframes, and required shot checklists.',
        tip: 'Assign primary and secondary crew members to prevent gaps if someone is swapping memory cards.'
      },
      {
        step: '02',
        title: 'Track Live Production Progress',
        desc: 'Use the "Home / Workspace" (/): watch the real-time counters for In Field, In Editing, In Review, and Approved.',
        tip: 'Filter overdue or pending uploads to reallocate unassigned photographers to active stage bottlenecks.'
      },
      {
        step: '03',
        title: 'Manage Drive Structure & Permissions',
        desc: 'Open "Drive Settings" (/drive) to verify the 35 synchronized Google Drive folders. Add subfolders on the fly or reset structure as needed.',
        tip: 'Ensure all crew members have the root Drive folder link bookmarked on their phones for fast reference.'
      },
      {
        step: '04',
        title: 'Generate Real-Time Reports',
        desc: 'Click "Export CSV" or "Export JSON" on the dashboard to hand comprehensive coverage reports to the Dean and University Administration.'
      }
    ],
    proTips: [
      'Conduct a 5-minute morning briefing with all photographers and editors before doors open at 09:00 AM.',
      'Check the Activity Logs (/audit) to monitor live upload timestamps and crew velocity.'
    ],
    recommendedGear: [
      'Laptop / Tablet for live assignment tracking on the move',
      'Two-way radio / Walkie-talkie for fast backstage crew dispatch'
    ],
    shortcutLink: '/assignments',
    shortcutLabel: 'Manage Crew Assignments'
  },
  PRESIDENT: {
    role: 'PRESIDENT',
    title: 'Leadership & Executive Playbook',
    badge: 'Executive Oversight & Governance',
    icon: Building,
    color: 'amber',
    summary: 'Executive dashboard for university directors, student council presidents, and institutional observers.',
    mission: 'Monitor festival milestones, verify coverage transparency, and access press-ready media archives in real time.',
    workflow: [
      {
        step: '01',
        title: 'Executive Bird\'s-Eye Overview',
        desc: 'Review the high-level metrics on the main dashboard: total festival tasks completed, raw assets captured, and approved deliverables.',
        tip: 'Spot check active event locations (Auditorium, OAT, Tech Block) to ensure high-priority sessions are fully covered.'
      },
      {
        step: '02',
        title: 'Review System Activity & Audit Trail',
        desc: 'Open "Activity Logs" (/audit) for a permanent, tamper-proof record of every upload, edit submission, and reviewer approval with timestamps.',
        tip: 'All actions are tagged with user identity and IP details for institutional compliance.'
      },
      {
        step: '03',
        title: 'Access Official Master Archives',
        desc: 'Use the Drive Root shortcut in the top navbar to access the organized Google Drive tree containing all raw and approved assets for PR and press kits.'
      }
    ],
    proTips: [
      'Coordinate with the university PR desk to pull approved photos for official press releases within 2 hours of event completion.'
    ],
    recommendedGear: [
      'Tablet or laptop with access to institutional email credentials'
    ],
    shortcutLink: '/',
    shortcutLabel: 'View Executive Dashboard'
  },
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    title: 'Super Administrator Playbook',
    badge: 'Full System Control & Architecture',
    icon: ShieldCheck,
    color: 'slate',
    summary: 'Complete architectural control over authentication, database sync, Drive integration, and role permissions.',
    mission: 'Maintain 99.99% uptime, zero data loss, strict role-based access, and enterprise-grade security for SAVISKAR 2026.',
    workflow: [
      {
        step: '01',
        title: 'Verify Database & Drive Integrations',
        desc: 'Check API health at /api/v1/health. Confirm Supabase PostgreSQL is connected in Cloud Mode and Google Drive OAuth tokens are active.',
        tip: 'If Google Drive tokens need re-authorization, visit Drive Settings to connect the master university account.'
      },
      {
        step: '02',
        title: 'Manage Crew Access & Roles',
        desc: 'Ensure all crew members register with their verified Gmail or university email addresses. Monitor active sessions in the Activity Logs.',
        tip: 'Super Admins can switch perspective to any role from the top-right navbar menu to verify user experience.'
      },
      {
        step: '03',
        title: 'Monitor Storage Quotas & Performance',
        desc: 'Verify that large 4K video uploads stream properly to Google Drive disk without exhausting server RAM.',
        tip: 'Local temporary uploads in uploads/ are automatically cleaned up after streaming to Drive.'
      }
    ],
    proTips: [
      'Take regular CSV exports of assignment metadata and keep a local backup of registered user credentials.',
      'Keep the backend server daemon running with process monitors (e.g. systemd or Docker) for zero downtime.'
    ],
    recommendedGear: [
      'SSH Terminal & Cloud Console access',
      'Local development environment for hotfixes'
    ],
    shortcutLink: '/drive',
    shortcutLabel: 'Open System Drive Settings'
  }
};

export const TutorialPage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.roles?.[0] || 'PHOTOGRAPHER');

  const activeTutorial = tutorials[selectedRole] || tutorials.PHOTOGRAPHER;
  const RoleIcon = activeTutorial.icon;

  const roleList: { role: UserRole; label: string; icon: any }[] = [
    { role: 'PHOTOGRAPHER', label: 'Photographer', icon: Camera },
    { role: 'VIDEOGRAPHER', label: 'Videographer', icon: Film },
    { role: 'VIDEO_EDITOR', label: 'Video Editor', icon: Sparkles },
    { role: 'REVIEWER', label: 'Reviewer / QC', icon: CheckSquare },
    { role: 'MEDIA_COORDINATOR', label: 'Coordinator', icon: ClipboardList },
    { role: 'PRESIDENT', label: 'President / Leadership', icon: Building },
    { role: 'SUPER_ADMIN', label: 'Super Admin', icon: ShieldCheck }
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-red-600" />
              <span>Crew Academy & Operational Playbook</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026 Production</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            How to Master Your Role
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
            Step-by-step guidance, camera & editing specs, workflow checklists, and pro tips to maximize your speed, quality, and impact during the festival.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={activeTutorial.shortcutLink}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
          >
            <span>{activeTutorial.shortcutLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Role Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {roleList.map(item => {
          const ItemIcon = item.icon;
          const isSelected = selectedRole === item.role;
          return (
            <button
              key={item.role}
              onClick={() => setSelectedRole(item.role)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-red-600 text-white shadow-xs scale-[1.02]'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <ItemIcon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role Overview Hero Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center font-bold text-xl shrink-0">
              <RoleIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block">
                {activeTutorial.badge}
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {activeTutorial.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700">
              Role: <strong className="text-slate-900">{selectedRole}</strong>
            </span>
          </div>
        </div>

        <p className="text-sm font-medium text-slate-700 leading-relaxed">
          {activeTutorial.summary}
        </p>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
          <Target className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold text-slate-900 block mb-0.5">Primary Festival Mission</span>
            <p className="text-xs text-slate-600 leading-relaxed">{activeTutorial.mission}</p>
          </div>
        </div>
      </div>

      {/* Step-by-Step Workflow Checklist */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Step-by-Step Production Workflow
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{activeTutorial.workflow.length} core phases</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeTutorial.workflow.map(item => (
            <div
              key={item.step}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2.5 relative overflow-hidden group hover:border-slate-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-slate-200 group-hover:text-red-200 font-mono transition-colors">
                  {item.step}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>

              <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>

              {item.tip && (
                <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span><strong>Pro Tip:</strong> {item.tip}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pro Tips & Best Practices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pro Tips */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Award className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-bold text-slate-900">Expert Tips to Maximize Speed</h3>
          </div>

          <div className="space-y-3">
            {activeTutorial.proTips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                  {idx + 1}
                </div>
                <p className="leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Equipment & Tooling */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Recommended Tooling & Checklist</h3>
          </div>

          <div className="space-y-2.5">
            {activeTutorial.recommendedGear.map((gear, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 flex items-center gap-2.5 font-medium">
                <div className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                <span>{gear}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <div className="p-6 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-elevated">
        <div className="space-y-1">
          <h4 className="text-base font-bold">Ready to Start Your Coverage?</h4>
          <p className="text-xs text-slate-400">
            Your crew profile is configured. Go straight to your dedicated workspace now.
          </p>
        </div>

        <Link
          to={activeTutorial.shortcutLink}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shrink-0"
        >
          <span>{activeTutorial.shortcutLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

export default TutorialPage;
