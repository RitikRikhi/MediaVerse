import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  UploadCloud,
  Film,
  CheckSquare,
  FolderSync,
  Bot,
  History,
  HardDrive,
  HelpCircle
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { isCoordinator, isFieldCrew, isEditor, isReviewer, isPresident, isSuperAdmin } = useAuth();

  const navItems = [
    {
      to: '/',
      label: 'Home / Workspace',
      icon: LayoutDashboard,
      show: true
    },
    {
      to: '/assignments',
      label: 'Assignments',
      icon: ClipboardList,
      show: true
    },
    {
      to: '/field-crew',
      label: 'Upload Media',
      icon: UploadCloud,
      show: true,
      badge: 'Photos / Video'
    },
    {
      to: '/editor',
      label: 'Editing Studio',
      icon: Film,
      show: true,
      badge: 'Reels / Cuts'
    },
    {
      to: '/reviews',
      label: 'Review & Approval',
      icon: CheckSquare,
      show: isReviewer || isCoordinator || isPresident || isSuperAdmin
    },
    {
      to: '/media',
      label: 'Media Library',
      icon: FolderSync,
      show: true
    },
    {
      to: '/ai',
      label: 'AI Assistant',
      icon: Bot,
      show: true,
      badge: 'Gemini'
    },
    {
      to: '/tutorial',
      label: 'Crew Tutorial',
      icon: HelpCircle,
      show: true,
      badge: 'Guide'
    },
    {
      to: '/drive',
      label: 'Drive Settings',
      icon: HardDrive,
      show: isCoordinator || isSuperAdmin
    },
    {
      to: '/audit',
      label: 'Activity Logs',
      icon: History,
      show: isCoordinator || isPresident || isSuperAdmin
    }
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              SAVISKAR 2026
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
              Oct 28–29
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">DSA Media Crew • CGC Mohali</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems
            .filter(item => item.show)
            .map(item => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                        item.badge === 'Gemini'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/70 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center justify-between">
            <span className="text-slate-700 font-semibold">DSA MediaVerse</span>
            <span className="font-mono text-[10px] text-slate-400">v1.2.0 • Pro</span>
          </div>
        </div>
      </aside>
    </>
  );
};
