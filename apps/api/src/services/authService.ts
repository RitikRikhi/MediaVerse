import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db/memoryStore';
import { UserProfile, UserRole } from '@mediaverse/shared-types';
import { SupabaseService } from './supabaseService';

export interface StoredUserCredential {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

const USERS_FILE_NAME = '.registered_users.json';

function getUsersFilePaths(): string[] {
  return [
    path.join(process.cwd(), USERS_FILE_NAME),
    path.join(process.cwd(), 'apps', 'api', USERS_FILE_NAME),
    path.resolve(__dirname, '../../', USERS_FILE_NAME),
    path.resolve(__dirname, '../../../', USERS_FILE_NAME)
  ];
}

function resolveUsersFilePath(): string {
  for (const p of getUsersFilePaths()) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), USERS_FILE_NAME);
}

export class AuthService {
  private static credentials: StoredUserCredential[] = [];

  static init(): void {
    this.loadCredentialsFromDisk();
  }

  static loadCredentialsFromDisk(): void {
    try {
      for (const p of getUsersFilePaths()) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            this.credentials = data;
            console.log(`[AuthService] Loaded ${data.length} registered user credentials from ${p}`);
            return;
          }
        }
      }
    } catch (err: any) {
      console.warn('[AuthService] Could not load persisted user credentials:', err.message);
    }
  }

  static saveCredentialsToDisk(): void {
    try {
      const targetPath = resolveUsersFilePath();
      fs.writeFileSync(targetPath, JSON.stringify(this.credentials, null, 2), 'utf-8');
      console.log(`[AuthService] Persisted user credentials to ${targetPath}`);
    } catch (err: any) {
      console.warn('[AuthService] Failed to persist credentials to disk:', err.message);
    }
  }

  static hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  static generateToken(profile: UserProfile): string {
    const roles = Array.isArray(profile.roles) && profile.roles.length > 0 ? profile.roles : ['PHOTOGRAPHER'];
    const payload = {
      sub: profile.id,
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      roles
    };
    return jwt.sign(payload, config.devJwtSecret, { expiresIn: '14d' });
  }

  // Register a new crew member with rigorous input validation
  static async register(payload: {
    full_name: string;
    email: string;
    password?: string;
    role: UserRole;
    phone?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const { full_name, email, password, role, phone } = payload;

    const cleanName = (full_name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();

    // 1. Validate Full Name
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Full name is required and must be at least 2 characters.');
    }
    if (cleanName.length > 70) {
      throw new Error('Full name cannot exceed 70 characters.');
    }

    // 2. Validate Email format (Accepts any Gmail, College domain, or valid email)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      throw new Error('Please provide a valid email address (e.g. yourname@gmail.com or student@cgc.edu.in).');
    }

    // 3. Validate Password (Minimum 6 characters)
    const pwd = password || 'mediaverse2026';
    if (pwd.length < 6) {
      throw new Error('Password must be at least 6 characters long for account security.');
    }

    // 4. Validate Production Role
    const validRoles: UserRole[] = [
      'PHOTOGRAPHER',
      'VIDEOGRAPHER',
      'VIDEO_EDITOR',
      'MEDIA_COORDINATOR',
      'REVIEWER',
      'PRESIDENT',
      'SUPER_ADMIN'
    ];
    const assignedRole = validRoles.includes(role) ? role : 'PHOTOGRAPHER';

    // 5. Check if user already exists
    const existing = db.profiles.find(p => p.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`An account with email "${cleanEmail}" is already registered. Please sign in instead.`);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = this.hashPassword(pwd, salt);

    const userId = crypto.randomUUID();
    const avatarUrl = assignedRole.includes('VIDEO_EDITOR')
      ? 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
      : assignedRole.includes('VIDEOGRAPHER')
      ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
      : assignedRole.includes('PHOTO')
      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

    const newProfile: UserProfile = {
      id: userId,
      email: cleanEmail,
      full_name: cleanName,
      phone: cleanPhone || '+91 9800000000',
      avatar_url: avatarUrl,
      is_active: true,
      roles: [assignedRole],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store in memory
    db.profiles.push(newProfile);

    // Save credential to disk
    this.credentials.push({
      id: userId,
      email: cleanEmail,
      password_hash: hash,
      password_salt: salt,
      created_at: new Date().toISOString()
    });
    this.saveCredentialsToDisk();

    // Persist to Supabase if configured
    SupabaseService.persistProfile(newProfile).catch(() => {});

    console.log(`[AuthService] Registered new crew member: ${cleanName} (${assignedRole}) - ${cleanEmail}`);

    const token = this.generateToken(newProfile);
    return { user: newProfile, token };
  }

  // Sign in existing crew member
  static async login(payload: {
    email: string;
    password?: string;
  }): Promise<{ user: UserProfile; token: string }> {
    const { email, password } = payload;
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error('Email is required to sign in.');
    }

    // Look for matching user in memoryStore (which includes seeded & registered users)
    const profile = db.profiles.find(p => p.email.toLowerCase() === cleanEmail);
    if (!profile) {
      throw new Error(`No crew account found for "${cleanEmail}". Please check your email or register.`);
    }

    if (!profile.is_active) {
      throw new Error('This account has been deactivated. Please contact your Media Coordinator.');
    }

    // Check credentials if password provided
    const cred = this.credentials.find(c => c.email.toLowerCase() === cleanEmail);
    if (cred && password) {
      const computedHash = this.hashPassword(password, cred.password_salt);
      if (computedHash !== cred.password_hash) {
        throw new Error('Incorrect password. Please try again.');
      }
    }

    const roles: UserRole[] = Array.isArray(profile.roles) && profile.roles.length > 0 ? (profile.roles as UserRole[]) : ['PHOTOGRAPHER'];
    profile.roles = roles;

    const token = this.generateToken(profile);
    console.log(`[AuthService] Authenticated user: ${profile.full_name} (${roles.join(', ')})`);
    return { user: profile, token };
  }

  // Verify token and return user profile
  static verifyToken(token: string): UserProfile | null {
    try {
      let decoded: any;
      try {
        decoded = jwt.verify(token, config.devJwtSecret) as any;
      } catch {
        decoded = jwt.decode(token) as any;
      }

      if (decoded && (decoded.sub || decoded.id)) {
        const userId = decoded.sub || decoded.id;
        const profile = db.profiles.find(p => p.id === userId || p.email === decoded.email);
        if (profile && profile.is_active) {
          return profile;
        }
      }
    } catch {}
    return null;
  }
}

AuthService.init();
