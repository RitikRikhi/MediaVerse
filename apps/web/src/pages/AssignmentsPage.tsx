import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Assignment, ShotChecklistItem, AssignmentStatus, PriorityLevel, CoverageType } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  FolderOpen,
  MapPin,
  Clock,
  Sparkles,
  Trash2,
  Camera,
  Video,
  Layers,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  UploadCloud,
  ChevronRight,
  UserCheck,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface TaskTemplate {
  name: string;
  icon: string;
  category: CoverageType;
  priority: PriorityLevel;
  session: string;
  title: string;
  deliverable: string;
  notes: string;
  checklist: string[];
}

const TASK_TEMPLATES: TaskTemplate[] = [
  {
    name: 'VIP Inauguration & Lamp',
    icon: '🎤',
    category: 'PHOTOGRAPHY',
    priority: 'CRITICAL',
    session: 'Day 1 - Morning',
    title: 'SAVISKAR 2026 Grand Inauguration & Lamp Lighting',
    deliverable: '35 curated high-res edited photos (VIP arrival, lamp flame lighting, keynote speech, standing ovation) + RAW folder backup',
    notes: `🎯 CREATIVE DIRECTIVES:\n• Capture formal arrival of Chief Guest and Chancellor at Block 3 porch with bouquet handover.\n• Stage Lamp Lighting: Continuous burst (10fps) to catch exact moment flames ignite with dignitaries looking at flame.\n• Audience: Balcony wide-angle view capturing full house standing ovation during the national anthem.\n\n⚙️ CAMERA & GEAR SPECS:\n• Primary Body: 24-70mm f/2.8 (Main stage wide & mid).\n• Secondary Body: 70-200mm f/2.8 (Tight expressions, dignitaries on dias).\n• Shutter Speed: 1/250s minimum to freeze moving hands/dignitaries.\n• ISO: Cap at 3200 (auditorium spotlights are bright on center stage).\n• Color Profile: Standard Neutral RAW, White Balance 4800K.\n\n⏰ TIMELINE & CALL TIMES:\n• Call Time: 08:15 AM sharp at Media Center (Block 3, Room 102).\n• Equipment & SD Check: 08:30 AM.\n• Chief Guest Arrival: 09:15 AM.\n• Ingestion Deadline: 13:00 PM (Hand off SD Card to Video/Photo Editor).`,
    checklist: [
      '[HERO] Chief Guest & Chancellor Porch Arrival & Floral Greeting',
      '[HERO] Dignitaries Lighting Ceremonial Lamp (Close-up flame & faces)',
      '[HERO] Keynote Speaker Address & Dias Dignitaries Panel',
      '[CROWD] Full Balcony High-Angle View of Packed Auditorium',
      '[SOCIAL 9:16] Vertical Slow-Mo of Guest Procession into Auditorium'
    ]
  },
  {
    name: 'Rock Band / Band Battle',
    icon: '🎸',
    category: 'VIDEOGRAPHY',
    priority: 'HIGH',
    session: 'Day 1 - Evening',
    title: 'Battle of the Bands & Rock Concert Multi-Cam Coverage',
    deliverable: 'Raw 4K 60fps multi-cam footage (Cam A Pit, Cam B Gimbal, Cam C FOH Wide) + Zoom H6 WAV soundboard audio stems',
    notes: `🎯 CREATIVE DIRECTIVES:\n• Cam A (Stage Right): Low-angle 24mm f/1.8 heroic angles of lead singer & guitarist jumping off monitors.\n• Cam B (Stage Left / Pit): 3-axis Gimbal operator tracking bassist and drummer close-up rhythm.\n• Cam C (Center FOH): Ultra-wide 16-35mm capturing stage pyrotechnics, laser lighting, and crowd moshpit.\n\n⚙️ CAMERA & GEAR SPECS:\n• Resolution: 4K (3840x2160) at 60fps (allows 50% slow-motion ramping).\n• Shutter Angle: 180° (1/120s shutter speed).\n• Picture Profile: S-Log3 / C-Log / V-Log for stage dynamic range highlights.\n• Audio: Line-level stereo feed from FOH mixer direct to Zoom H6 (-12dB safety track).\n\n⏰ TIMELINE & CALL TIMES:\n• Call Time: 16:45 PM at OAT Sound Console.\n• Soundcheck & Multi-Cam Sync: 17:15 PM.\n• First Band On Stage: 17:45 PM.\n• Ingestion Deadline: 22:30 PM (Footage handed over to Video Editors).`,
    checklist: [
      '[HERO] Drum Solo 60fps/120fps Slow-Mo with Cymbal Smoke',
      '[HERO] Lead Guitarist Solo Jump Off Stage Riser',
      '[CROWD] Sea of 3000 Mobile Flashlights Sing-Along Wide Pan',
      '[HERO] Confetti Explosion During Headliner Band Finale',
      '[SOCIAL 9:16] Vertical Whip-Pan Transition from Crowd to Singer'
    ]
  },
  {
    name: 'Dance / Cultural Stage',
    icon: '💃',
    category: 'HYBRID',
    priority: 'HIGH',
    session: 'Day 1 - Afternoon',
    title: 'Inter-College Group Dance & Fashion Showcase',
    deliverable: '50 Action Stage Photos + 4K Multi-Cam Dance Cuts + 2 Vertical Reels for Instagram',
    notes: `🎯 CREATIVE DIRECTIVES:\n• Capture high-energy group formations, synchronized jumps, and vibrant traditional costumes.\n• Freeze motion with fast shutter; track solo performers with fast autofocus.\n\n⚙️ CAMERA & GEAR SPECS:\n• 70-200mm f/2.8 & 24-70mm f/2.8.\n• Shutter 1/500s for fast jumps; 60fps video for slow-motion spins.\n\n⏰ CALL TIME: 13:30 PM at Main Auditorium.`,
    checklist: [
      '[HERO] Synchronized Group Dance Mid-Air Jump Freeze',
      '[HERO] Lead Performer Dramatic Facial Expression & Spotlight',
      '[CROWD] Cheering College Contingents Waving Flags & Banners',
      '[SOCIAL 9:16] Vertical Slow-Mo Reel of Costume Spin & Stage Smoke'
    ]
  },
  {
    name: 'Robo-Wars & Hackathon',
    icon: '🤖',
    category: 'HYBRID',
    priority: 'MEDIUM',
    session: 'Day 2 - Morning',
    title: 'Robo-Wars Championship & Hackathon 24hr Sprint',
    deliverable: '25 High-impact action photos (arena sparks) + 12 Slow-mo B-roll clips for Day 2 recap reel',
    notes: `🎯 CREATIVE DIRECTIVES:\n• Robo-Wars Arena: Shoot through polycarbonate safety shield. Capture weapon spins, metal flips, and electric spark showers.\n• Hackathon 24hr Sprint: Candid captures of teams debugging code, whiteboard diagrams, coffee cup stacks, and intense screen focus.\n• Awards: Winner team standing behind their fighting robot with trophy.\n\n⚙️ CAMERA & GEAR SPECS:\n• Lenses: 85mm f/1.4 (for intimate coder focus falloff) & 24-70mm f/2.8.\n• Frame Rate: 120fps slow-motion for robot collisions and flips.\n• Shutter Speed: 1/500s minimum for arena metal sparks.\n\n⏰ TIMELINE & CALL TIMES:\n• Call Time: 09:30 AM at Tech Arena Control Desk.\n• Hackathon Final Pitch: 10:30 AM.\n• Robo-Wars Semis & Finals: 11:30 AM - 13:30 PM.\n• Ingestion Deadline: 14:30 PM.`,
    checklist: [
      '[HERO] Bot-on-Bot High Speed Collision with Metal Sparks Flying',
      '[HERO] Flipped Robot Smoke & Countdown Buzzer',
      '[CANDID] Exhausted Coders Cheering at Successful 24hr Code Demo',
      '[HERO] Winner Team Holding Trophy Behind Battle Bot in Arena'
    ]
  },
  {
    name: '60s Social Media Reel',
    icon: '📱',
    category: 'VIDEOGRAPHY',
    priority: 'CRITICAL',
    session: 'Day 1 - Night',
    title: 'SAVISKAR 2026 Day 1 Viral 60s Instagram Reel Cut',
    deliverable: '1080x1920 9:16 Vertical Reel, 60fps, Color Graded, Audio Mastered (-14 LUFS) with Trendy Beat Sync',
    notes: `🎯 CREATIVE DIRECTIVES:\n• Fast-paced hook in first 3 seconds (pyrotechnics or celebrity walk-on).\n• Beat-matched cuts: Lamp lighting, rock concert moshpit, drone stadium sweep, laughing students.\n\n⚙️ SPECS: 1080x1920 MP4, H.264, 60fps, 35Mbps bitrate.\n\n⏰ DEADLINE: Deliver to Social Media lead within 90 minutes of night session finish.`,
    checklist: [
      '[SOCIAL 9:16] 3-Second Viral Opening Hook (Fireworks / Laser Flare)',
      '[SOCIAL 9:16] Quick-Cut Montage of 5 Campus Events in 15 Seconds',
      '[SOCIAL 9:16] Student Shoutout "SAVISKAR 2026 CGC University!" to Camera',
      '[HERO] Closing Title Card with Official Festival Logo & Tagline'
    ]
  },
  {
    name: 'Valedictory Trophy Lift',
    icon: '🏆',
    category: 'PHOTOGRAPHY',
    priority: 'HIGH',
    session: 'Day 2 - Afternoon',
    title: 'SAVISKAR 2026 Grand Valedictory, Award Ceremony & Trophy Lift',
    deliverable: '40 crisp stage award photos (every winning college delegation with shields) + Grand Overall Championship Trophy Lift celebration',
    notes: `🎯 CREATIVE DIRECTIVES:\n• Stage Presentations: Every single winning team must be framed with Vice Chancellor, Director, and Guest of Honor holding the certificate and trophy.\n• Focus: Ensure all winning team faces are sharp and visible (shoot at f/4 to f/5.6 for group depth of field).\n• Grand Finale: The Overall Championship Trophy presentation with golden confetti poppers — shoot continuous high-speed burst.\n\n⚙️ CAMERA & GEAR SPECS:\n• Lenses: 24-70mm f/2.8 (primary for group podiums), 70-200mm f/2.8 (for tight emotional reactions).\n• Lighting: On-camera speedlight with MagMod diffuser or ceiling bounce for balanced shadow fill on stage.\n• Aperture: f/4 minimum on team photos so back row is sharp.\n\n⏰ TIMELINE & CALL TIMES:\n• Call Time: 14:15 PM at Main Auditorium Stage.\n• Award Presentation Begins: 15:30 PM.\n• Overall Trophy Lift: 17:45 PM.\n• Full Photo Drop Deadline: 19:30 PM.`,
    checklist: [
      '[HERO] Overall University Champion College Trophy Lift with Golden Confetti',
      '[HERO] Academic & Cultural Dean Handing Over First-Place Gold Shields',
      '[CANDID] Winning Students Embracing and Celebrating in Aisle',
      '[HERO] Entire CGC Media Crew & Organizing Committee Official Stage Group Photo'
    ]
  }
];

export const AssignmentsPage: React.FC = () => {
  const { isCoordinator, isSuperAdmin, allUsers } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { checklist: ShotChecklistItem[] }) | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'shotlist' | 'specs' | 'crew' | 'storage'>('shotlist');
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [coverageFilter, setCoverageFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Assignment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [statusTargetAssignment, setStatusTargetAssignment] = useState<Assignment | null>(null);
  const [newStatus, setNewStatus] = useState<AssignmentStatus>('CAPTURING');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusError, setStatusError] = useState('');

  // Add custom checklist item in detail modal
  const [newCustomShot, setNewCustomShot] = useState('');
  const [isAddingShot, setIsAddingShot] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formCoverage, setFormCoverage] = useState<CoverageType>('PHOTOGRAPHY');
  const [formPriority, setFormPriority] = useState<PriorityLevel>('HIGH');
  const [formSession, setFormSession] = useState('Day 1 - Morning');
  const [formStartTime, setFormStartTime] = useState('2026-10-28T09:00');
  const [formDeadline, setFormDeadline] = useState('2026-10-28T13:00');
  const [formDeliverable, setFormDeliverable] = useState('');
  const [formDriveUrl, setFormDriveUrl] = useState('https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO');
  const [formNotes, setFormNotes] = useState('');
  const [formAssignedUsers, setFormAssignedUsers] = useState<string[]>([]);
  const [formChecklist, setFormChecklist] = useState<string[]>([
    '[HERO] Key VIP Stage Arrival & Welcome',
    '[HERO] Main Highlight Performance / Keynote',
    '[CROWD] Audience Standing Ovation & Wide Hall View',
    '[SOCIAL 9:16] Vertical Slow-Mo Transition Hook'
  ]);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load assignments', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // Filter effect
  useEffect(() => {
    let result = [...assignments];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.expected_deliverable.toLowerCase().includes(q) ||
          (a.location_name && a.location_name.toLowerCase().includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'ALL') {
      result = result.filter(a => a.status === statusFilter);
    }
    if (coverageFilter !== 'ALL') {
      result = result.filter(a => a.coverage_type === coverageFilter);
    }
    if (priorityFilter !== 'ALL') {
      result = result.filter(a => a.priority === priorityFilter);
    }
    setFilteredAssignments(result);
  }, [assignments, search, statusFilter, coverageFilter, priorityFilter]);

  const handleOpenDetail = async (id: string, defaultTab: 'shotlist' | 'specs' | 'crew' | 'storage' = 'shotlist') => {
    try {
      setActiveDetailTab(defaultTab);
      const details = await api.getAssignment(id);
      setSelectedAssignment(details);
    } catch (err) {
      console.error('Failed to load assignment detail', err);
    }
  };

  const handleToggleChecklist = async (itemId: string) => {
    if (!selectedAssignment) return;
    try {
      const updated = await api.toggleChecklistItem(selectedAssignment.id, itemId);
      setSelectedAssignment(prev => {
        if (!prev) return null;
        return {
          ...prev,
          checklist: prev.checklist.map(c => (c.id === itemId ? updated : c))
        };
      });
      loadAssignments();
    } catch (err) {
      console.error('Failed to toggle checklist', err);
    }
  };

  const handleAddCustomShot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !newCustomShot.trim()) return;
    try {
      setIsAddingShot(true);
      const created = await api.addChecklistItem(selectedAssignment.id, {
        shot_title: newCustomShot.trim(),
        is_required: true
      });
      setSelectedAssignment(prev => {
        if (!prev) return null;
        return {
          ...prev,
          checklist: [...prev.checklist, created]
        };
      });
      setNewCustomShot('');
      loadAssignments();
    } catch (err: any) {
      alert(err.message || 'Failed to add shot directive');
    } finally {
      setIsAddingShot(false);
    }
  };

  const handleOpenStatusModal = (assignment: Assignment) => {
    setStatusTargetAssignment(assignment);
    setNewStatus(assignment.status);
    setStatusNotes('');
    setStatusError('');
    setShowStatusModal(true);
  };

  const handleSaveStatus = async () => {
    if (!statusTargetAssignment) return;
    try {
      setStatusError('');
      await api.updateAssignmentStatus(statusTargetAssignment.id, newStatus, statusNotes);
      setShowStatusModal(false);
      loadAssignments();
      if (selectedAssignment?.id === statusTargetAssignment.id) {
        handleOpenDetail(statusTargetAssignment.id);
      }
    } catch (err: any) {
      setStatusError(err.message || 'Status transition failed.');
    }
  };

  const handlePromptDelete = (assignment: Assignment) => {
    setTaskToDelete(assignment);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteAssignment(taskToDelete.id);
      setShowDeleteModal(false);
      setTaskToDelete(null);
      if (selectedAssignment?.id === taskToDelete.id) {
        setSelectedAssignment(null);
      }
      loadAssignments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete assignment');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApplyTemplate = (tmpl: TaskTemplate) => {
    setFormTitle(tmpl.title);
    setFormCoverage(tmpl.category);
    setFormPriority(tmpl.priority);
    setFormSession(tmpl.session);
    setFormDeliverable(tmpl.deliverable);
    setFormNotes(tmpl.notes);
    setFormChecklist([...tmpl.checklist]);

    // Auto-select relevant crew roles
    if (tmpl.category === 'PHOTOGRAPHY') {
      const photogs = allUsers.filter(u => u.roles.includes('PHOTOGRAPHER')).map(u => u.id);
      setFormAssignedUsers(photogs);
    } else if (tmpl.category === 'VIDEOGRAPHY') {
      const videos = allUsers.filter(u => u.roles.includes('VIDEOGRAPHER')).map(u => u.id);
      setFormAssignedUsers(videos);
    } else {
      const hybrid = allUsers.filter(u => u.roles.some(r => ['PHOTOGRAPHER', 'VIDEOGRAPHER'].includes(r))).map(u => u.id);
      setFormAssignedUsers(hybrid);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAssignment({
        event_id: assignments[0]?.event_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: formTitle,
        coverage_type: formCoverage,
        priority: formPriority,
        day_session: formSession,
        start_time: new Date(formStartTime).toISOString(),
        deadline: new Date(formDeadline).toISOString(),
        expected_deliverable: formDeliverable,
        drive_folder_url: formDriveUrl || undefined,
        notes: formNotes || undefined,
        assigned_user_ids: formAssignedUsers,
        checklist_items: formChecklist.filter(Boolean).map(shot_title => ({
          shot_title,
          is_required: true
        }))
      });

      setShowCreateModal(false);
      setFormTitle('');
      setFormDeliverable('');
      setFormNotes('');
      setFormAssignedUsers([]);
      loadAssignments();
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment');
    }
  };

  // Helper to color-tag checklist shot titles
  const renderShotTag = (title: string) => {
    if (title.includes('[HERO]')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          HERO
        </span>
      );
    }
    if (title.includes('[CROWD]')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          CROWD
        </span>
      );
    }
    if (title.includes('[SOCIAL 9:16]')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
          9:16 REEL
        </span>
      );
    }
    if (title.includes('[CANDID]') || title.includes('[B-ROLL]')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          CANDID
        </span>
      );
    }
    return null;
  };

  const cleanShotTitle = (title: string) => {
    return title.replace(/\[HERO\]|\[CROWD\]|\[SOCIAL 9:16\]|\[CANDID\]|\[B-ROLL\]|\[DRONE\]|\[BACKSTAGE\]/g, '').trim();
  };

  // Quick Stats
  const totalTasks = assignments.length;
  const capturingTasks = assignments.filter(a => a.status === 'CAPTURING').length;
  const readyForEditTasks = assignments.filter(a => ['AVAILABLE_FOR_EDITING', 'EDITING'].includes(a.status)).length;
  const deliveredTasks = assignments.filter(a => a.status === 'DELIVERED').length;

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Top Banner & Fast Stats */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-600 text-white uppercase tracking-wider">
              SAVISKAR 2026
            </span>
            <span className="text-xs text-slate-500 font-semibold">• Media Crew Operations Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Event Tasks & Shot Directives
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Real-time coverage schedule, creative shot directions, camera settings, and direct Google Drive storage for CGC University field crew.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(isCoordinator || isSuperAdmin) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          )}

          <Link
            to="/field-crew"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
          >
            <UploadCloud className="w-4 h-4 text-red-400" />
            <span>1-Tap Upload</span>
          </Link>
        </div>
      </div>

      {/* 4 Summary Stat Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</span>
            <p className="text-xl font-bold text-slate-900">{totalTasks}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Capturing Now</span>
            <p className="text-xl font-bold text-amber-900">{capturingTasks}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Camera className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Ready for Edit</span>
            <p className="text-xl font-bold text-blue-900">{readyForEditTasks}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Video className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Delivered</span>
            <p className="text-xl font-bold text-emerald-900">{deliveredTasks}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search tasks, venues, deliverables, or gear specs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CAPTURING">Capturing</option>
            <option value="UPLOAD_PENDING">Upload Pending</option>
            <option value="AVAILABLE_FOR_EDITING">Ready for Edit</option>
            <option value="EDITING">Editing</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="DELIVERED">Delivered</option>
          </select>

          {/* Coverage filter */}
          <select
            value={coverageFilter}
            onChange={e => setCoverageFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Coverage</option>
            <option value="PHOTOGRAPHY">📸 Photography</option>
            <option value="VIDEOGRAPHY">🎥 Videography</option>
            <option value="HYBRID">⚡ Hybrid (Photo + Video)</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">🔴 Critical</option>
            <option value="HIGH">🟠 High</option>
            <option value="MEDIUM">🟡 Medium</option>
          </select>
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-sm font-semibold">
            Loading SAVISKAR 2026 operations roster...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
            <p className="text-sm font-bold text-slate-800">No tasks match your search filter</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          filteredAssignments.map(assignment => {
            const checklistTotal = assignment.checklist_summary?.total || 0;
            const checklistDone = assignment.checklist_summary?.completed || 0;
            const progressPercent = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

            return (
              <div
                key={assignment.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top badges & delete button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={assignment.priority} />
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 uppercase tracking-wider">
                        {assignment.coverage_type === 'PHOTOGRAPHY' ? (
                          <Camera className="w-3 h-3 text-red-600" />
                        ) : assignment.coverage_type === 'VIDEOGRAPHY' ? (
                          <Video className="w-3 h-3 text-blue-600" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-amber-600" />
                        )}
                        {assignment.coverage_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={assignment.status} />
                      {(isCoordinator || isSuperAdmin) && (
                        <button
                          onClick={() => handlePromptDelete(assignment)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {assignment.title}
                  </h3>

                  {/* Metadata (Venue, Session, Due) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">
                        {assignment.location_name || 'Main Auditorium'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{assignment.day_session}</span>
                    </div>
                  </div>

                  {/* Required Deliverable Callout */}
                  <div className="text-xs text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold block mb-0.5">
                      Required Deliverable:
                    </span>
                    <span className="font-semibold leading-relaxed line-clamp-2">
                      {assignment.expected_deliverable}
                    </span>
                  </div>

                  {/* Shot Checklist Progress Bar */}
                  {checklistTotal > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Shot Checklist Progress</span>
                        <span className="font-bold text-slate-800">
                          {checklistDone}/{checklistTotal} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            progressPercent === 100
                              ? 'bg-emerald-600'
                              : progressPercent > 50
                              ? 'bg-blue-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Crew + Action buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Crew Avatars */}
                  <div className="flex items-center gap-1.5">
                    {assignment.assigned_members && assignment.assigned_members.length > 0 ? (
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {assignment.assigned_members.map(m => (
                          <div
                            key={m.user_id}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-[11px] font-bold text-red-800 border-2 border-white shadow-xs"
                            title={`${m.full_name} (${m.role})`}
                          >
                            {m.full_name.charAt(0)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {assignment.drive_folder_url && (
                      <a
                        href={assignment.drive_folder_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
                        title="Open Google Drive folder"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      onClick={() => handleOpenStatusModal(assignment)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                    >
                      Status
                    </button>

                    <button
                      onClick={() => handleOpenDetail(assignment.id, 'shotlist')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
                    >
                      <span>Directives</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Deep Task Directives & Detail Modal */}
      {selectedAssignment && (
        <Modal
          isOpen={Boolean(selectedAssignment)}
          onClose={() => setSelectedAssignment(null)}
          title={selectedAssignment.title}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Header info bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={selectedAssignment.priority} />
                <StatusBadge status={selectedAssignment.status} />
                <span className="text-xs text-slate-500 font-semibold">• {selectedAssignment.day_session}</span>
                <span className="text-xs text-slate-500 font-semibold">• {selectedAssignment.location_name || 'Main Auditorium'}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenStatusModal(selectedAssignment)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Change Status
                </button>
                {(isCoordinator || isSuperAdmin) && (
                  <button
                    onClick={() => {
                      setSelectedAssignment(null);
                      handlePromptDelete(selectedAssignment);
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 text-xs font-bold">
              <button
                onClick={() => setActiveDetailTab('shotlist')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeDetailTab === 'shotlist'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Shotlist & Directives ({selectedAssignment.checklist.filter(c => c.is_completed).length}/{selectedAssignment.checklist.length})</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('specs')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeDetailTab === 'specs'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Camera & Gear Specs</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('crew')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeDetailTab === 'crew'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Assigned Crew</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('storage')}
                className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeDetailTab === 'storage'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                <span>Google Drive</span>
              </button>
            </div>

            {/* TAB 1: Shotlist & Directives */}
            {activeDetailTab === 'shotlist' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-red-50/60 border border-red-100 text-xs text-red-900 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Required Deliverable: </span>
                    <span className="font-medium">{selectedAssignment.expected_deliverable}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedAssignment.checklist.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(item.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        item.is_completed
                          ? 'bg-emerald-50/60 border-emerald-200 text-slate-600'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900 shadow-xs'
                      }`}
                    >
                      <button className="mt-0.5 text-red-600 shrink-0">
                        {item.is_completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 hover:text-red-500" />
                        )}
                      </button>

                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            {renderShotTag(item.shot_title)}
                            <span className={`text-xs font-bold ${item.is_completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              {cleanShotTitle(item.shot_title)}
                            </span>
                          </div>

                          {item.is_required && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 uppercase">
                              Required
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="text-[11px] text-slate-500 font-medium">
                            {item.description}
                          </p>
                        )}

                        {item.is_completed && item.completed_at && (
                          <p className="text-[10px] text-emerald-700 font-semibold">
                            ✓ Captured at {new Date(item.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {item.completed_by_name ? ` by ${item.completed_by_name}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Custom Shot on the fly */}
                <form onSubmit={handleAddCustomShot} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add custom shot directive on the fly (e.g. VIP car exit)..."
                    value={newCustomShot}
                    onChange={e => setNewCustomShot(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={isAddingShot || !newCustomShot.trim()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white shrink-0"
                  >
                    {isAddingShot ? 'Adding...' : 'Add Shot'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: Camera & Gear Specs */}
            {activeDetailTab === 'specs' && (
              <div className="space-y-3">
                {selectedAssignment.notes ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                    {selectedAssignment.notes}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    No technical notes recorded for this task yet.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Assigned Crew */}
            {activeDetailTab === 'crew' && (
              <div className="space-y-3">
                {selectedAssignment.assigned_members && selectedAssignment.assigned_members.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedAssignment.assigned_members.map(member => (
                      <div
                        key={member.user_id}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center text-sm border border-red-200">
                            {member.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{member.full_name}</p>
                            <span className="text-[10px] font-semibold text-red-600 uppercase tracking-wider block">
                              {member.role}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate block">{member.email}</span>
                          </div>
                        </div>

                        <a
                          href={`mailto:${member.email}`}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
                          title="Send Email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs italic">
                    No crew members assigned yet.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Google Drive & Upload */}
            {activeDetailTab === 'storage' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-red-600" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Google Drive Cloud Storage</h4>
                      <p className="text-[11px] text-slate-500">
                        Target directory for photos, RAW camera clips, and video edit exports.
                      </p>
                    </div>
                  </div>

                  {selectedAssignment.drive_folder_url && (
                    <a
                      href={selectedAssignment.drive_folder_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition-colors shadow-xs"
                    >
                      <FolderOpen className="w-4 h-4 text-red-600" />
                      <span>Open in Google Drive ↗</span>
                    </a>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-red-900">Need to upload files for this task?</h5>
                    <p className="text-[11px] text-red-700">Use the Turbo Event Mode field crew uploader.</p>
                  </div>
                  <Link
                    to="/field-crew"
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs"
                  >
                    Go to Uploader &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Change Status Modal */}
      {showStatusModal && statusTargetAssignment && (
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title={`Update Status: ${statusTargetAssignment.title}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-1">Current Status:</p>
              <StatusBadge status={statusTargetAssignment.status} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select New Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as AssignmentStatus)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
              >
                <option value="ASSIGNED">ASSIGNED (Initial Planning)</option>
                <option value="CAPTURING">CAPTURING (Field Crew Active on Venue)</option>
                <option value="UPLOAD_PENDING">UPLOAD_PENDING (Footage Shot, Ingesting)</option>
                <option value="AVAILABLE_FOR_EDITING">AVAILABLE_FOR_EDITING (Raw Media Ready for Editors)</option>
                <option value="EDITING">EDITING (Video Editor Assembling Cuts)</option>
                <option value="IN_REVIEW">IN_REVIEW (Edit Submitted for Review)</option>
                <option value="REVISION_REQUIRED">REVISION_REQUIRED (Changes Requested)</option>
                <option value="APPROVED">APPROVED (QC Approved)</option>
                <option value="DELIVERED">DELIVERED (Final High-Res Delivered)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transition Reason / Notes</label>
              <textarea
                value={statusNotes}
                onChange={e => setStatusNotes(e.target.value)}
                placeholder="e.g., Raw 4K clips uploaded to Day 1 folder, ready for editing."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            {statusError && (
              <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {statusError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                Save Status Transition
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && taskToDelete && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Confirm Task Deletion"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-bold">Are you sure you want to delete this task?</p>
              <p className="font-semibold text-slate-900">"{taskToDelete.title}"</p>
              <p className="text-[11px] text-red-600 pt-1">
                This will permanently remove the assignment, all its shot checklist items, and crew assignments.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Assignment Modal with Fast Templates */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create SAVISKAR 2026 Assignment"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateAssignment} className="space-y-4">
            {/* Quick Template Selector */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Quick-Fill from Event Template (1-Tap Fast Fill)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TASK_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50/50 text-left transition-all group"
                  >
                    <span className="text-base mr-1">{tmpl.icon}</span>
                    <span className="text-[11px] font-bold text-slate-800 group-hover:text-red-700 block">
                      {tmpl.name}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      {tmpl.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assignment Title *</label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Celebrity Star Night Stage Coverage"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Coverage Type</label>
                <select
                  value={formCoverage}
                  onChange={e => setFormCoverage(e.target.value as CoverageType)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="PHOTOGRAPHY">📸 Photography</option>
                  <option value="VIDEOGRAPHY">🎥 Videography</option>
                  <option value="HYBRID">⚡ Hybrid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Session / Slot</label>
                <input
                  type="text"
                  required
                  value={formSession}
                  onChange={e => setFormSession(e.target.value)}
                  placeholder="Day 1 - Evening"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Deliverable *</label>
              <input
                type="text"
                required
                value={formDeliverable}
                onChange={e => setFormDeliverable(e.target.value)}
                placeholder="e.g. 50 curated high-res edited photos + RAW folder link"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Technical Notes & Camera Directives</label>
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={4}
                placeholder="Lenses, shutter speed, ISO limits, audio inputs, call times..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Checklist Items */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Initial Shot Checklist Items</label>
              {formChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={e => {
                      const updated = [...formChecklist];
                      updated[idx] = e.target.value;
                      setFormChecklist(updated);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setFormChecklist(formChecklist.filter((_, i) => i !== idx))}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFormChecklist([...formChecklist, 'New Shot Directive'])}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Checklist Item</span>
              </button>
            </div>

            {/* Crew Assignees */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assign Media Crew Members</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allUsers
                  .filter(u => u.roles.some(r => ['PHOTOGRAPHER', 'VIDEOGRAPHER', 'VIDEO_EDITOR'].includes(r)))
                  .map(member => (
                    <label
                      key={member.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        formAssignedUsers.includes(member.id)
                          ? 'bg-red-50 border-red-300 text-red-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formAssignedUsers.includes(member.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormAssignedUsers([...formAssignedUsers, member.id]);
                          } else {
                            setFormAssignedUsers(formAssignedUsers.filter(id => id !== member.id));
                          }
                        }}
                        className="rounded text-red-600 focus:ring-0"
                      />
                      <span className="truncate">{member.full_name}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs"
              >
                Create Assignment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
