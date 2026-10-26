import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { UserRole } from '@mediaverse/shared-types';

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'User authentication required for this action.'
        }
      });
    }

    // Super Admin has universal access
    if (req.user.roles.includes('SUPER_ADMIN')) {
      return next();
    }

    const hasPermission = req.user.roles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of [${allowedRoles.join(', ')}]. Current roles: [${req.user.roles.join(', ')}]`
        }
      });
    }

    next();
  };
}
