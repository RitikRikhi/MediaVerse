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
  isFieldCrew: boolean;
  isReviewer: boolean;
  isPresident: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('MEDIA_COORDINATOR');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  const refreshUser = async () => {
    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      if (currentUser.roles && currentUser.roles.length > 0) {
        setActiveRole(currentUser.roles[0]);
      }
    } catch (err) {
      console.warn('Failed to load active user, falling back to Coordinator', err);
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
  const isEditor = hasRole('VIDEO_EDITOR', 'SUPER_ADMIN');
  const isFieldCrew = hasRole('PHOTOGRAPHER', 'VIDEOGRAPHER', 'SUPER_ADMIN');
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
