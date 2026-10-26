import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CoordinatorMetrics, Assignment } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import {
  ClipboardCheck,
  AlertTriangle,
  Camera,
  Film,
  CheckCircle2,
  Clock,
  Sparkles,
  Download,
  FolderOpen,
  ArrowRight,
  UploadCloud,
  CheckSquare,
  FileCheck,
  Zap,
  ChevronRight,
  Play,
  BookOpen,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user, isFieldCrew, isEditor, isCoordinator, isSuperAdmin, isPresident } = useAuth();
  const [metrics, setMetrics] = useState<CoordinatorMetrics | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [urgentAssignments, setUrgentAssignments] = useState<Assignment[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [m, aList, logs] = await Promise.all([
        api.getMetrics(),
        api.getAssignments(),
        api.getAuditLogs(8)
      ]);
      setMetrics(m);
      setAssignments(aList);

      const urgent = aList
        .filter(a => a.priority === 'CRITICAL' || a.priority === 'HIGH' || a.status === 'UPLOAD_PENDING')
        .slice(0, 5);
      setUrgentAssignments(urgent);
      setRecentLogs(logs);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/v1/reports/export?format=${format}`, '_blank');
  };

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  // Filter tasks specific to current user for field crew / editor
  const myAssignedTasks = assignments.filter(a =>
    a.assigned_members?.some(m => m.user_id === user?.id)
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Event Header Banner (Clean White + Deep Crimson Red) */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-card p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
                OCTOBER 28–29, 2026
              </span>
              <span className="text-xs text-slate-500 font-medium">• CGC University, Mohali</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              SAVISKAR 2026 Production Hub
            </h1>

            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Welcome back, <strong>{user?.full_name || 'Crew Member'}</strong>! DSA Media Crew central operations for photography, 4K multi-cam footage, video editing pipelines, and review approvals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/field-crew"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Media</span>
            </Link>

            <Link
              to="/ai"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-red-600" />
              <span>AI Briefs</span>
            </Link>

            {(isCoordinator || isSuperAdmin || isPresident) && (
              <>
                <button
                  onClick={() => handleExport('csv')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Role Academy & Tutorial Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold">Crew Tutorial & Role Playbook</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white text-red-700 uppercase tracking-wider">
                All Roles
              </span>
            </div>
            <p className="text-xs text-red-100 mt-0.5 max-w-xl leading-relaxed">
              New to SAVISKAR 2026? Learn step-by-step production workflows, camera setups, cutting specs, and review criteria to unleash your maximum potential.
            </p>
          </div>
        </div>
        <Link
          to="/tutorial"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-red-700 hover:bg-red-50 font-bold text-xs shrink-0 shadow-xs transition-colors self-start sm:self-auto"
        >
          <span>Open Playbook</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Live Services Strip: Google Drive Root & Gemini AI Guard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a
          href="https://drive.google.com/drive/u/0/folders/1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 shadow-xs flex items-center justify-between group transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                  DSA MediaVerse - SAVISKAR 2026
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Drive Connected
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
        </a>

        <Link
          to="/ai"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 shadow-xs flex items-center justify-between group transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200/60">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                  Gemini Media Operations Engine
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                  Zero-Error Guard
                </span>
              </div>
              <p className="text-[11px] text-slate-500">gemini-3.5-flash-lite • Semantic Cache Active</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* ROLE-CUSTOMIZED SECTION: "What Should I Do Next?" */}
      {isFieldCrew && !isCoordinator && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Your Action Checklist for Today</h2>
              <p className="text-xs text-slate-500">Immediate shooting and upload responsibilities.</p>
            </div>
            <Link
              to="/field-crew"
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <span>Open Field Portal</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(myAssignedTasks.length > 0 ? myAssignedTasks : assignments.slice(0, 3)).map(task => (
              <div
                key={task.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} size="sm" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{task.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{task.expected_deliverable}</p>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">{task.day_session}</span>
                  <Link
                    to="/field-crew"
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline"
                  >
                    <span>Upload Photos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Row (for Coordinators, Admins, Leadership) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Total Tasks</span>
            <ClipboardCheck className="w-4 h-4 text-slate-700" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics?.total_assignments || 0}</p>
          <span className="text-[11px] text-slate-500 font-medium">Day 1 & Day 2</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">In Field</span>
            <Camera className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700">
            {(metrics?.capturing || 0) + (metrics?.upload_pending || 0)}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">{metrics?.upload_pending || 0} upload pending</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">In Editing</span>
            <Film className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-700">
            {(metrics?.editing || 0) + (metrics?.available_for_editing || 0)}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">{metrics?.available_for_editing || 0} ready to edit</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">In Review</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700">{metrics?.in_review || 0}</p>
          <span className="text-[11px] text-slate-500 font-medium">{metrics?.revision_required || 0} revisions</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{metrics?.approved || 0}</p>
          <span className="text-[11px] text-slate-500 font-medium">{metrics?.delivered || 0} broadcast final</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Drive Assets</span>
            <FolderOpen className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-black text-red-700">{metrics?.total_registered_assets || 0}</p>
          <span className="text-[11px] text-slate-500 font-medium">Logged in Cloud</span>
        </div>
      </div>

      {/* Two Column Layout: Urgent Tasks + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Urgent Tasks */}
        <div className="xl:col-span-2 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Priority & Overdue Production Tasks
              </h3>
              <p className="text-xs text-slate-500">Tasks requiring immediate shooting or upload</p>
            </div>
            <Link
              to="/assignments"
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {urgentAssignments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No high-urgency bottlenecks detected.</p>
            ) : (
              urgentAssignments.map(a => (
                <div
                  key={a.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={a.priority} />
                      <StatusBadge status={a.status} size="sm" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{a.title}</h4>
                    <p className="text-[11px] text-slate-500">
                      {a.location_name} • {a.day_session}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Link
                      to="/field-crew"
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-colors"
                    >
                      Upload Media
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Production Activity */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Recent Activity Feed</h3>
            <span className="text-[11px] text-slate-400 font-semibold">Live Audit</span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {recentLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent activity.</p>
            ) : (
              recentLogs.map((log: any) => (
                <div key={log.id} className="text-xs space-y-0.5 pb-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{log.actor_name || 'System User'}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
