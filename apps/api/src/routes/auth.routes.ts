import { Router, Response, Request } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { db } from '../db/memoryStore';
import { UserRole } from '@mediaverse/shared-types';
import { AuthService } from '../services/authService';
import { AuditService } from '../services/auditService';
import { DriveService } from '../services/driveService';

export const authRouter = Router();

// Crew Member Sign In
authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Email address is required to sign in.' }
    });
  }

  try {
    const result = await AuthService.login({ email, password });
    // Proactively provision user's personal drive in Google Drive in background
    DriveService.provisionPersonalUserDrive(result.user).catch(err => {
      console.warn(`[DriveService] Background personal drive provisioning notice: ${err.message}`);
    });
    AuditService.log({
      actorId: result.user.id,
      actorName: result.user.full_name,
      actorRole: result.user.roles[0],
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: result.user.id,
      details: { email: result.user.email, roles: result.user.roles }
    });
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message: err.message || 'Login failed' }
    });
  }
});

// Crew Member Registration
authRouter.post('/register', async (req: Request, res: Response) => {
  const { full_name, email, password, role, phone } = req.body;

  if (!full_name || !email || !role) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'Full name, email, and role are required.' }
    });
  }

  try {
    const result = await AuthService.register({
      full_name,
      email,
      password,
      role: role as UserRole,
      phone
    });

    // Proactively provision user's personal drive in Google Drive in background
    DriveService.provisionPersonalUserDrive(result.user).catch(err => {
      console.warn(`[DriveService] Background personal drive provisioning notice: ${err.message}`);
    });

    AuditService.log({
      actorId: result.user.id,
      actorName: result.user.full_name,
      actorRole: result.user.roles[0],
      action: 'USER_REGISTER',
      entityType: 'USER',
      entityId: result.user.id,
      details: { email: result.user.email, role: result.user.roles[0] }
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message || 'Registration failed' }
    });
  }
});

// Current user profile
authRouter.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: req.user
  });
});

// List crew members
authRouter.get('/users', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: db.profiles.map(p => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      phone: p.phone,
      avatar_url: p.avatar_url,
      roles: p.roles,
      is_active: p.is_active
    }))
  });
});

// Fast Dev Persona Switcher (Convenient role testing for local demo mode)
authRouter.post('/switch-dev-role', (req: AuthenticatedRequest, res: Response) => {
  const { role } = req.body;
  const targetUser = db.profiles.find(p => p.roles.includes(role as UserRole));

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      error: { code: 'ROLE_NOT_FOUND', message: `No pre-seeded user found for role ${role}` }
    });
  }

  const token = AuthService.generateToken(targetUser);

  res.json({
    success: true,
    data: {
      user: targetUser,
      token
    }
  });
});
