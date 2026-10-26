import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  ClipboardList,
  Film,
  FolderOpen
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  const navItems = [
    {
      to: '/',
      label: 'Home',
      icon: LayoutDashboard,
      isActive: location.pathname === '/'
    },
    {
      to: '/field-crew',
      label: 'Upload',
      icon: UploadCloud,
      isPrimary: true,
      isActive: location.pathname === '/field-crew' || location.pathname === '/upload'
    },
    {
      to: '/assignments',
      label: 'Tasks',
      icon: ClipboardList,
      isActive: location.pathname === '/assignments'
    },
    {
      to: '/editor',
      label: 'Editor',
      icon: Film,
      isActive: location.pathname === '/editor'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-elevated lg:hidden">
      <div className="grid grid-cols-5 items-center h-16 px-1 max-w-md mx-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center h-full py-1 text-[11px] font-bold transition-all relative ${
                item.isActive
                  ? 'text-red-600'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {item.isPrimary ? (
                <div
                  className={`flex items-center justify-center w-11 h-11 rounded-2xl shadow-sm transition-transform -mt-4 border-2 border-white ${
                    item.isActive
                      ? 'bg-red-600 text-white scale-105'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              ) : (
                <Icon className={`w-5 h-5 mb-0.5 ${item.isActive ? 'text-red-600' : 'text-slate-400'}`} />
              )}
              <span className={item.isPrimary ? 'mt-0.5 text-[10px] font-black' : 'text-[10px]'}>
                {item.label}
              </span>
              {item.isActive && !item.isPrimary && (
                <span className="absolute bottom-1 w-1 h-1 bg-red-600 rounded-full" />
              )}
            </NavLink>
          );
        })}

        {/* 5th Button: Direct Drive Root Link */}
        <a
          href="https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO"
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center justify-center h-full py-1 text-[11px] font-bold text-slate-500 hover:text-amber-600 transition-colors"
        >
          <FolderOpen className="w-5 h-5 mb-0.5 text-amber-500" />
          <span className="text-[10px]">Drive ↗</span>
        </a>
      </div>
    </nav>
  );
};
