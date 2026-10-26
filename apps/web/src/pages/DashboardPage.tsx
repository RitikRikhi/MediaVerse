import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CoordinatorMetrics, Assignment } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import {
  Camera,
  Film,
  UploadCloud,
  ClipboardList,
  FolderOpen,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle,
  Zap,
  HelpCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user, isCoordinator, isSuperAdmin, isPresident } = useAuth();
  const [metrics, setMetrics] = useState<CoordinatorMetrics | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeDay, setActiveDay] = useState<'DAY_1' | 'DAY_2'>('DAY_1');
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const [m, aList] = await Promise.all([
        api.getMetrics(),
        api.getAssignments()
      ]);
      setMetrics(m);
      setAssignments(aList);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const filteredTasks = assignments.filter(a => {
    if (activeDay === 'DAY_1') return /day\s*1/i.test(a.day_session);
    return /day\s*2/i.test(a.day_session);
  });

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-8">
      {/* Welcome Banner Card */}
      <div className="p-5 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-red-600 text-white uppercase tracking-wider">
              SAVISKAR 2026
            </span>
            <span className="text-xs text-slate-500 font-medium">October 28–29, 2026 • CGC University</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hi, {user?.full_name?.split(' ')[0] || 'Crew Member'}! 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
            Choose what you need to do below. All photos and 4K footage automatically sync to the official Google Drive.
          </p>
        </div>

        {/* Live Drive Badge + Fast Upload button */}
        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Drive Live Sync Active</span>
          </div>

          <Link
            to="/field-crew"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Fast Camera Upload</span>
          </Link>
        </div>
      </div>

      {/* 4 MAIN ACTION TILES (The 1-Tap Core Launchpad) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Camera Crew Upload */}
        <Link
          to="/field-crew"
          className="group p-5 rounded-2xl bg-white border-2 border-slate-200 hover:border-red-500 hover:shadow-card transition-all flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white flex items-center justify-center transition-colors">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                  Camera Upload
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                  ⚡ Turbo
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Drop raw photos or 4K videos directly into Drive with 90% faster Turbo Mode.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-bold text-red-600 group-hover:translate-x-1 transition-transform">
            <span>Upload Media Now &rarr;</span>
          </div>
        </Link>

        {/* Tile 2: Live Tasks & Shotlists */}
        <Link
          to="/assignments"
          className="group p-5 rounded-2xl bg-white border-2 border-slate-200 hover:border-blue-500 hover:shadow-card transition-all flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Event Tasks
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                See what events are happening right now, who is assigned, and required shots.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
            <span>View All Tasks &rarr;</span>
          </div>
        </Link>

        {/* Tile 3: Editing Studio */}
        <Link
          to="/editor"
          className="group p-5 rounded-2xl bg-white border-2 border-slate-200 hover:border-purple-500 hover:shadow-card transition-all flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center transition-colors">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                Editing Studio
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Grab raw camera footage, edit highlight reels, and submit cuts for approval.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform">
            <span>Open Studio &rarr;</span>
          </div>
        </Link>

        {/* Tile 4: Direct Google Drive */}
        <a
          href="https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO"
          target="_blank"
          rel="noreferrer"
          className="group p-5 rounded-2xl bg-white border-2 border-slate-200 hover:border-amber-500 hover:shadow-card transition-all flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center transition-colors">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                Master Drive
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Open official SAVISKAR 2026 Google Drive with all Day 1 & Day 2 folders.
              </p>
            </div>
          </div>
          <div className="flex items-center text-xs font-bold text-amber-600 group-hover:translate-x-1 transition-transform">
            <span>Open in Google Drive ↗</span>
          </div>
        </a>
      </div>

      {/* QUICK STATUS METRICS (Clean Minimalist Strip) */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tasks</span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{metrics.total_assignments}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Currently Shooting</span>
            <p className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{metrics.capturing}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">In Editing</span>
            <p className="text-xl sm:text-2xl font-black text-purple-600 mt-0.5">{metrics.editing}</p>
          </div>
          <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Approved Deliverables</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{metrics.approved}</p>
          </div>
        </div>
      )}

      {/* LIVE EVENT SCHEDULE & ACTION CARDS */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Event Coverage Schedule</h2>
            <p className="text-xs text-slate-500">Tap any event to view briefing or upload files immediately.</p>
          </div>

          {/* Day 1 / Day 2 Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
            <button
              onClick={() => setActiveDay('DAY_1')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeDay === 'DAY_1' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day 1 (Oct 28)
            </button>
            <button
              onClick={() => setActiveDay('DAY_2')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeDay === 'DAY_2' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Day 2 (Oct 29)
            </button>
          </div>
        </div>

        {/* Event Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredTasks.length === 0 ? (
            <div className="col-span-full p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
              No tasks scheduled for this day yet.
            </div>
          ) : (
            filteredTasks.slice(0, 6).map(task => (
              <div
                key={task.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex flex-col justify-between space-y-3 transition-all hover:shadow-2xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} size="sm" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{task.title}</h3>
                  <div className="text-[11px] text-slate-500 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{task.location_name || 'Main Auditorium'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{task.day_session}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {task.coverage_type}
                  </span>

                  <Link
                    to="/field-crew"
                    className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline"
                  >
                    <span>Upload &rarr;</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredTasks.length > 6 && (
          <div className="pt-2 text-center">
            <Link
              to="/assignments"
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-red-600 transition-colors"
            >
              <span>View All {filteredTasks.length} Tasks &rarr;</span>
            </Link>
          </div>
        )}
      </div>

      {/* Playbook Help Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-xs font-bold">Need help or camera specs?</h4>
            <p className="text-[11px] text-red-100 mt-0.5">
              Read the Crew Playbook for framing guidelines, DaVinci Resolve render specs, and approval steps.
            </p>
          </div>
        </div>
        <Link
          to="/tutorial"
          className="px-4 py-2 rounded-xl bg-white text-red-700 font-bold text-xs shrink-0 hover:bg-red-50 transition-colors self-start sm:self-auto"
        >
          Open Guide &rarr;
        </Link>
      </div>
    </div>
  );
};
