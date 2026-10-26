import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { db } from '../db/memoryStore';

export const notificationsRouter = Router();

notificationsRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userNotifications = db.notifications
    .filter(n => n.user_id === req.user!.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({
    success: true,
    data: userNotifications
  });
});

notificationsRouter.patch('/:id/read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const notification = db.notifications.find(n => n.id === req.params.id && n.user_id === req.user!.id);
  if (!notification) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Notification not found' }
    });
  }

  notification.is_read = true;

  res.json({
    success: true,
    data: notification
  });
});

notificationsRouter.post('/mark-all-read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  db.notifications
    .filter(n => n.user_id === req.user!.id)
    .forEach(n => {
      n.is_read = true;
    });

  res.json({
    success: true,
    data: { message: 'All notifications marked as read.' }
  });
});
