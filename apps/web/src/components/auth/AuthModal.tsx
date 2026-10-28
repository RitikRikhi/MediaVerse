import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Modal } from '../ui/Modal';
import {
  Camera,
  Film,
  Sparkles,
  ClipboardList,
  CheckCircle,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  LogIn,
  UserPlus,
  Lock,
  Mail,
  User,
  Phone,
  Check,
  Cloud,
  Zap,
  HardDrive,
  Smartphone,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const quickCrewProfiles: {
  name: string;
  role: UserRole;
  email: string;
  icon: any;
  badge: string;
}[] = [
  {
    name: 'Prof. Rajesh Sharma',
    role: 'SUPER_ADMIN',
    email: 'admin@dsa.cgc.edu.in',
    icon: ShieldCheck,
    badge: 'bg-purple-100 text-purple-900 border-purple-300'
  },
  {
    name: 'Priya Patel',
    role: 'MEDIA_COORDINATOR',
    email: 'coordinator@dsa.cgc.edu.in',
    icon: ClipboardList,
    badge: 'bg-red-50 text-red-700 border-red-200'
  },
  {
    name: 'Rohan Singh',
    role: 'PHOTOGRAPHER',
    email: 'photographer@dsa.cgc.edu.in',
    icon: Camera,
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200'
  },
  {
    name: 'Vikram Malhotra',
    role: 'VIDEOGRAPHER',
    email: 'videographer@dsa.cgc.edu.in',
    icon: Film,
    badge: 'bg-blue-50 text-blue-800 border-blue-200'
  },
  {
    name: 'Simran Kaur',
    role: 'VIDEO_EDITOR',
    email: 'editor@dsa.cgc.edu.in',
    icon: Sparkles,
    badge: 'bg-purple-50 text-purple-800 border-purple-200'
  }
];

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login form state (auto-remember last used email)
  const [loginEmail, setLoginEmail] = useState(() => localStorage.getItem('mediaverse_last_email') || '');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state (auto-remember last used email)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState(() => localStorage.getItem('mediaverse_last_email') || '');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('PHOTOGRAPHER');
  const [regPhone, setRegPhone] = useState('');

  // Touched state for live inline input validation
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    phone: false
  });

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Validation rules
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isRegNameValid = regName.trim().length >= 2;
  const isRegEmailValid = emailRegex.test(regEmail.trim());
  const isRegPasswordValid = regPassword.length >= 6;
  const isFormValid = isRegNameValid && isRegEmailValid && isRegPasswordValid;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address to sign in.');
      return;
    }
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. yourname@gmail.com).');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      await login(cleanEmail, loginPassword);
      localStorage.setItem('mediaverse_last_email', cleanEmail);
      setSuccessMsg('Signed in successfully! Entering workspace...');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.toLowerCase().includes('no crew account') || errMsg.toLowerCase().includes('not found') || errMsg.toLowerCase().includes('register')) {
        setRegEmail(cleanEmail);
        setTab('REGISTER');
        setErrorMsg(`No account found for "${cleanEmail}" yet. Switched to Register — just enter your name and you're in!`);
      } else {
        setErrorMsg(errMsg || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, phone: true });

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();

    if (!cleanName || cleanName.length < 2) {
      setErrorMsg('Full name is required and must be at least 2 characters.');
      return;
    }

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setErrorMsg('Please provide a valid email address (e.g. yourname@gmail.com or student@cgc.edu.in).');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      await register({
        full_name: cleanName,
        email: cleanEmail,
        password: regPassword,
        role: regRole,
        phone: regPhone.trim() || '+91 9876543210'
      });
      localStorage.setItem('mediaverse_last_email', cleanEmail);
      setSuccessMsg(`🎉 Welcome to SAVISKAR 2026, ${cleanName}! Your Google Drive access is active for ${cleanEmail}. Entering workspace...`);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already exists')) {
        setLoginEmail(cleanEmail);
        setTab('LOGIN');
        setErrorMsg(`"${cleanEmail}" is already registered! Please enter your password to sign in.`);
      } else {
        setErrorMsg(errMsg || 'Registration failed. Please check inputs.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (email: string) => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      await login(email);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Quick login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DSA Media Crew Workspace Access"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Header Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => {
              setTab('LOGIN');
              setErrorMsg('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
              tab === 'LOGIN'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => {
              setTab('REGISTER');
              setErrorMsg('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center justify-center gap-2 ${
              tab === 'REGISTER'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Join Media Crew (Register)</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 font-medium animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold animate-fade-in">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Sign In */}
        {tab === 'LOGIN' ? (
          <div className="space-y-4">
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="e.g. yourname@gmail.com or photographer@dsa.cgc.edu.in"
                    required
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Works with any Gmail, CGC University email, or registered account.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Enter password (optional for seeded demo accounts)"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !loginEmail.trim()}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Signing in...' : 'Sign In to Workspace'}</span>
              </button>
            </form>

            {/* Quick Demo Access Bar */}
            <div className="pt-2 border-t border-slate-100">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                1-Click Crew Member Presets:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {quickCrewProfiles.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.email}
                      type="button"
                      onClick={() => handleQuickLogin(item.email)}
                      className="p-2 rounded-xl border border-slate-200 hover:border-red-300 hover:bg-red-50/40 text-left transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-red-100 group-hover:text-red-700 flex items-center justify-center text-slate-600 shrink-0 transition-colors">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-red-700">{item.name}</p>
                          <p className="text-[10px] text-slate-500 capitalize">{item.role.replace('_', ' ').toLowerCase()}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-red-600 group-hover:underline shrink-0">
                        Select &rarr;
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Register New Crew Member */
          <div className="space-y-3.5">
            {/* 1-Minute Quick Guide: How Google Drive & Data Transfer Works */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border border-red-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-red-600 shrink-0" />
                  <span>⚡ 1-Minute Quick Guide: How Your Drive & Data Transfer Works</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-red-600 text-white uppercase tracking-wider">
                  Tomorrow Ready
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700">
                <div className="p-2 rounded-xl bg-white border border-red-100/80 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-extrabold shrink-0">1</span>
                    <span>Enter Gmail ID</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Your Gmail is instantly granted cloud access to the festival's official Google Drive folder structure.
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-white border border-red-100/80 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-extrabold shrink-0">2</span>
                    <span>Pick From Phone / PC</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Select 10, 50, or 100+ RAW photos or 4K videos directly from your mobile camera roll or SD card.
                  </p>
                </div>
                <div className="p-2 rounded-xl bg-white border border-red-100/80 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-extrabold shrink-0">3</span>
                    <span>1-Tap Start Upload</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    Files stream straight into your assigned Google Drive event folder. Zero manual sharing or Drive app needed!
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Full Name *</label>
                  {touched.name && !isRegNameValid && (
                    <span className="text-[10px] font-semibold text-rose-600">At least 2 characters required</span>
                  )}
                </div>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={regName}
                    onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
                    onChange={e => setRegName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    required
                    className={`w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border text-xs text-slate-900 focus:outline-none transition-colors ${
                      touched.name && !isRegNameValid
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-red-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Gmail Address *</label>
                    {touched.email && !isRegEmailValid && (
                      <span className="text-[10px] font-semibold text-rose-600">Invalid email</span>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      value={regEmail}
                      onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com"
                      required
                      className={`w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border text-xs text-slate-900 focus:outline-none transition-colors ${
                        touched.email && !isRegEmailValid
                          ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                          : 'border-slate-200 focus:border-red-500'
                      }`}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    🔒 Automatically linked to your SAVISKAR 2026 Google Drive.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Used for event-day emergency crew alerts.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Create Password *</label>
                  <span className={`text-[10px] font-semibold ${regPassword.length >= 6 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {regPassword.length >= 6 ? '✓ 6+ characters' : 'Min 6 characters'}
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={regPassword}
                    onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    className={`w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border text-xs text-slate-900 focus:outline-none transition-colors ${
                      touched.password && !isRegPasswordValid
                        ? 'border-rose-400 focus:border-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-red-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Crew Role (Auto-configures your Drive Folder) *
                </label>
                <select
                  value={regRole}
                  onChange={e => setRegRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
                >
                  <option value="SUPER_ADMIN">👑 Super Admin — Full master access & Drive Studio control</option>
                  <option value="MEDIA_COORDINATOR">🛡️ Admin (Media Coordinator) — Crew lead, operations & assignments</option>
                  <option value="PHOTOGRAPHER">📸 Photographer — Photo coverage & RAW uploads</option>
                  <option value="VIDEOGRAPHER">🎥 Videographer — 4K video clips & camera stems</option>
                  <option value="VIDEO_EDITOR">🎬 Video Editor — Reels, edits & assembly drafts</option>
                  <option value="REVIEWER">🔍 Reviewer — QC, approval & feedback</option>
                  <option value="PRESIDENT">🎓 President / Leadership — Executive festival oversight</option>
                </select>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Everything sets up in under <strong>60 seconds</strong>. All uploaded media will automatically carry your name and timestamp in Google Drive.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isLoading ? 'Setting up your Drive workspace...' : 'Register & Start Uploading (1-Min Setup)'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
};
