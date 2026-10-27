import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { api } from '../lib/api';

interface AuthContextType {
  user: UserProfile | null;
  activeRole: UserRole;
  isAuthenticated: boolean;
  switchRole: (role: UserRole) => Promise<void>;
  login: (email: string, password?: string) => Promise<void>;
  register: (payload: {
    full_name: string;
    email: string;
    password?: string;
    role: UserRole;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  allUsers: UserProfile[];
  hasRole: (...roles: UserRole[]) => boolean;
  isCoordinator: boolean;
  isSuperAdmin: boolean;
  isEditor: boolean;
  isPhotographer: boolean;
  isVideographer: boolean;
  isFieldCrew: boolean;
  isReviewer: boolean;
  isPresident: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Instantly remember user from localStorage so there's 0ms logout flicker or lost sessions
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem('mediaverse_user_profile');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    try {
      const stored = localStorage.getItem('mediaverse_user_profile');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.roles && u.roles.length > 0) return u.roles[0];
      }
    } catch {}
    return 'MEDIA_COORDINATOR';
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const refreshUser = async () => {
    const token = localStorage.getItem('mediaverse_auth_token');
    const activeUserId = localStorage.getItem('mediaverse_active_user_id');
    if (!token && !activeUserId) {
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await api.getCurrentUser();
      if (currentUser && currentUser.id) {
        setUser(currentUser);
        localStorage.setItem('mediaverse_user_profile', JSON.stringify(currentUser));
        if (currentUser.roles && currentUser.roles.length > 0) {
          setActiveRole(prev => (currentUser.roles.includes(prev) ? prev : currentUser.roles[0]));
        }
      }
    } catch (err: any) {
      console.warn('Could not validate current user with server:', err.message);
      // Only clear if explicitly unauthorized 401
      if (err.message && err.message.toLowerCase().includes('unauthorized')) {
        localStorage.removeItem('mediaverse_user_profile');
        localStorage.removeItem('mediaverse_active_user_id');
        localStorage.removeItem('mediaverse_auth_token');
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const users = await api.getAllUsers();
      setAllUsers(users);
    } catch (e) {
      console.warn('Could not load users list', e);
    }
  };

  useEffect(() => {
    refreshUser();
    loadAllUsers();
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      setUser(res.user);
      localStorage.setItem('mediaverse_user_profile', JSON.stringify(res.user));
      localStorage.setItem('mediaverse_active_user_id', res.user.id);
      localStorage.setItem('mediaverse_auth_token', res.token);
      if (res.user.roles && res.user.roles.length > 0) {
        setActiveRole(res.user.roles[0]);
      }
      setShowAuthModal(false);
      await loadAllUsers();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    full_name: string;
    email: string;
    password?: string;
    role: UserRole;
    phone?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await api.register(payload);
      setUser(res.user);
      localStorage.setItem('mediaverse_user_profile', JSON.stringify(res.user));
      localStorage.setItem('mediaverse_active_user_id', res.user.id);
      localStorage.setItem('mediaverse_auth_token', res.token);
      if (res.user.roles && res.user.roles.length > 0) {
        setActiveRole(res.user.roles[0]);
      }
      setShowAuthModal(false);
      await loadAllUsers();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('mediaverse_user_profile');
    localStorage.removeItem('mediaverse_active_user_id');
    localStorage.removeItem('mediaverse_auth_token');
    // Default to first user or unauthenticated
    setUser(null);
    setShowAuthModal(true);
  };

  const switchRole = async (role: UserRole) => {
    try {
      setIsLoading(true);
      const res = await api.switchDevRole(role);
      setUser(res.user);
      localStorage.setItem('mediaverse_user_profile', JSON.stringify(res.user));
      localStorage.setItem('mediaverse_active_user_id', res.user.id);
      localStorage.setItem('mediaverse_auth_token', res.token);
      setActiveRole(role);
    } catch (err) {
      console.error('Failed to switch role', err);
    } finally {
      setIsLoading(false);
    }
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    if (user.roles.includes('SUPER_ADMIN')) return true;
    return roles.some(r => user.roles.includes(r));
  };

  const isSuperAdmin = user?.roles.includes('SUPER_ADMIN') ?? false;
  const isCoordinator = hasRole('MEDIA_COORDINATOR', 'SUPER_ADMIN');
  const isEditor = Boolean(activeRole === 'VIDEO_EDITOR' || (!isCoordinator && user?.roles.includes('VIDEO_EDITOR')));
  const isPhotographer = Boolean(activeRole === 'PHOTOGRAPHER' || (!isCoordinator && user?.roles.includes('PHOTOGRAPHER')));
  const isVideographer = Boolean(activeRole === 'VIDEOGRAPHER' || (!isCoordinator && user?.roles.includes('VIDEOGRAPHER')));
  const isFieldCrew = Boolean(isPhotographer || isVideographer || isCoordinator);
  const isReviewer = hasRole('REVIEWER', 'SUPER_ADMIN');
  const isPresident = hasRole('PRESIDENT', 'SUPER_ADMIN');
  const isAuthenticated = Boolean(user && user.id);

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        isAuthenticated,
        login,
        register,
        logout,
        showAuthModal,
        setShowAuthModal,
        switchRole,
        allUsers,
        hasRole,
        isCoordinator,
        isSuperAdmin,
        isEditor,
        isPhotographer,
        isVideographer,
        isFieldCrew,
        isReviewer,
        isPresident,
        isLoading,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
