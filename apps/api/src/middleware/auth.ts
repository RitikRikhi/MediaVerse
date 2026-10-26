import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db/memoryStore';
import { UserProfile, UserRole } from '@mediaverse/shared-types';
import { AuthService } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // 1. Check for custom user header (useful for rapid UI testing / role switching)
  const devUserId = req.headers['x-user-id'] as string;
  if (devUserId) {
    const profile = db.profiles.find(p => p.id === devUserId && p.is_active);
    if (profile) {
      req.user = profile;
      return next();
    }
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Verify token using AuthService
    const userFromToken = AuthService.verifyToken(token);
    if (userFromToken) {
      req.user = userFromToken;
      return next();
    }

    // Direct role token fallback (e.g. "Bearer dev-coordinator")
    if (token.startsWith('dev-')) {
      const roleName = token.replace('dev-', '').toUpperCase();
      const profile = db.profiles.find(p => p.roles.includes(roleName as UserRole));
      if (profile) {
        req.user = profile;
        return next();
      }
    }
  }

  // 3. In local dev mode, default to Media Coordinator persona if unauthenticated (unless explicitly testing anonymous access)
  if (config.env === 'development' && req.headers['x-anonymous'] !== 'true' && process.env.NODE_ENV !== 'test') {
    const defaultCoordinator = db.profiles.find(p => p.roles.includes('MEDIA_COORDINATOR'));
    if (defaultCoordinator) {
      req.user = defaultCoordinator;
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication token missing or invalid. Please sign in.'
    }
  });
}
