import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, InAppNotification } from '../../types';
import { api } from '../../lib/api';
import {
  Bell,
  Menu,
  UserCheck,
  ExternalLink,
  FolderOpen,
  ChevronDown,
  LogIn,
  LogOut,
  UserPlus,
  HelpCircle
} from 'lucide-react';
import { AuthModal } from '../auth/AuthModal';
import { TutorialModal } from '../tutorial/TutorialModal';

interface NavbarProps {
  onToggleSidebar: () => void;
}

const roleNames: Record<UserRole, { label: string; badge: string; desc: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', badge: 'bg-red-50 text-red-700 border-red-200', desc: 'Full System Control' },
  PRESIDENT: { label: 'President / Leadership', badge: 'bg-amber-50 text-amber-800 border-amber-200', desc: 'High-Level Overview & Audits' },
  MEDIA_COORDINATOR: { label: 'Media Coordinator', badge: 'bg-red-50 text-red-700 border-red-200', desc: 'Operations & Assignments Lead' },
  PHOTOGRAPHER: { label: 'Photographer', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200', desc: 'Photo Coverage & RAW Uploads' },
  VIDEOGRAPHER: { label: 'Videographer', badge: 'bg-blue-50 text-blue-800 border-blue-200', desc: 'Video Footage & 4K Stems' },
  VIDEO_EDITOR: { label: 'Video Editor', badge: 'bg-purple-50 text-purple-800 border-purple-200', desc: 'Reels, Edits & Cuts' },
  REVIEWER: { label: 'Reviewer', badge: 'bg-rose-50 text-rose-800 border-rose-200', desc: 'QC & Approval Lead' }
};

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, activeRole, switchRole, allUsers, logout, showAuthModal, setShowAuthModal } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch {
      // Ignore background errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-2 text-slate-500 rounded-lg hover:text-slate-800 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-600 text-white font-black tracking-wider text-sm shadow-sm">
              MV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base">
                  DSA MediaVerse
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                  SAVISKAR 2026
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                CGC University • Media Crew Production Hub
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Crew Tutorial / Playbook Quick Launcher */}
          <button
            onClick={() => setShowTutorialModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-200 hover:border-red-200 transition-colors"
            title="Open Crew Tutorial & Role Playbook"
          >
            <HelpCircle className="w-3.5 h-3.5 text-red-600" />
            <span className="hidden sm:inline">Crew Playbook</span>
          </button>

          {/* Drive Quick Link */}
          <a
            href="https://drive.google.com/drive/u/0/folders/1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-200 hover:border-red-200 transition-colors"
            title="Open SAVISKAR 2026 Google Drive Root Folder"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Drive Root</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Notifications Tray */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 transition-colors"
              title="Operational Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-600 rounded-full shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-elevated overflow-hidden z-50 animate-fade-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-red-100 text-red-700 font-semibold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No new notifications. Everything is up to date!
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`p-3.5 hover:bg-slate-50 transition-colors ${
                          !n.is_read ? 'bg-red-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-slate-900">{n.title}</h4>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account / Role Persona Menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition-colors text-left"
              >
                <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0 border border-red-200">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="flex flex-col text-left min-w-0">
                  <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[90px] sm:max-w-[140px] md:max-w-[180px]">
                    {user?.full_name || 'Crew Member'}
                  </span>
                  <span className="text-[10px] font-semibold text-red-600 truncate max-w-[90px] sm:max-w-[140px]">
                    {roleNames[activeRole]?.label || activeRole}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-elevated p-2 z-50 animate-fade-in">
                  <div className="px-3 py-2 border-b border-slate-100 mb-2">
                    <p className="text-xs font-bold text-slate-900">{user.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          setShowAuthModal(true);
                        }}
                        className="text-xs text-slate-600 hover:text-red-600 font-semibold flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Switch User</span>
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={() => {
                          setShowRoleMenu(false);
                          logout();
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>

                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Role Perspective:
                  </div>

                  <div className="space-y-1">
                    {(Object.keys(roleNames) as UserRole[]).map(roleKey => {
                      const info = roleNames[roleKey];
                      const isCurrent = activeRole === roleKey;
                      const matchingUser = allUsers.find(u => u.roles.includes(roleKey));

                      return (
                        <button
                          key={roleKey}
                          onClick={() => {
                            switchRole(roleKey);
                            setShowRoleMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                            isCurrent
                              ? 'bg-red-50 text-red-700 font-bold border border-red-200'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{info.label}</span>
                              {isCurrent && <UserCheck className="w-3.5 h-3.5 text-red-600" />}
                            </div>
                            <p className="text-[10px] text-slate-400 font-normal">{matchingUser?.full_name || info.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Join Crew</span>
            </button>
          )}
        </div>
      </header>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Global Crew Tutorial Playbook Modal */}
      <TutorialModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        initialRole={activeRole}
      />
    </>
  );
};
