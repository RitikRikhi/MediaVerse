import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { db } from '../db/memoryStore';

export const auditRouter = Router();

auditRouter.get(
  '/',
  authMiddleware,
  requireRoles('MEDIA_COORDINATOR', 'PRESIDENT', 'SUPER_ADMIN'),
  (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = [...db.activityLogs].slice(0, limit);

    res.json({
      success: true,
      data: logs
    });
  }
);
