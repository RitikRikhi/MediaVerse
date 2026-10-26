import { Router, Response, Request } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { DriveService } from '../services/driveService';
import { db } from '../db/memoryStore';
import { AuditService } from '../services/auditService';
import { config } from '../config';

export const driveRouter = Router();

// Drive integration status check
driveRouter.get('/status', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: DriveService.getStatus()
  });
});

// Resolve automated folder destination
driveRouter.get('/destination', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const daySession = (req.query.day_session || req.query.day) as string;
  const mediaType = (req.query.media_type || req.query.type) as string;
  const destination = DriveService.resolveDestination(daySession, mediaType);

  res.json({
    success: true,
    data: destination
  });
});

// Get Google OAuth 2.0 Authorization URL
driveRouter.get('/auth-url', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const returnUrl = (req.query.return_url as string) || `${config.appBaseUrl}/drive?connected=true`;
  const url = DriveService.getOAuthUrl(returnUrl);
  res.json({
    success: true,
    data: {
      authUrl: url,
      isConfigured: config.google.isConfigured
    }
  });
});

// OAuth 2.0 Callback handler
driveRouter.get('/oauth2callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const targetRedirect = state ? decodeURIComponent(state) : `${config.appBaseUrl}/drive?connected=true`;

  if (!code) {
    return res.redirect(`${config.appBaseUrl}/drive?error=missing_code`);
  }

  const result = await DriveService.exchangeCodeForToken(code);
  if (result.success) {
    const separator = targetRedirect.includes('?') ? '&' : '?';
    return res.redirect(`${targetRedirect}${separator}connected=true`);
  } else {
    return res.redirect(`${config.appBaseUrl}/drive?error=${encodeURIComponent(result.message)}`);
  }
});

// Disconnect Google Drive
driveRouter.post('/disconnect', authMiddleware, requireRoles('MEDIA_COORDINATOR', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  DriveService.disconnect();
  AuditService.log({
    actorId: req.user!.id,
    actorName: req.user!.full_name,
    actorRole: req.user!.roles[0],
    action: 'DISCONNECT_GOOGLE_DRIVE',
    entityType: 'INTEGRATION',
    entityId: 'google-drive',
    details: { disconnectedAt: new Date().toISOString() }
  });
  res.json({
    success: true,
    data: { message: 'Google Drive disconnected successfully.' }
  });
});

// Get active folder structure and flat list
driveRouter.get('/structure', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      structure: DriveService.getFolderStructure(),
      flatList: DriveService.getFlatFolderList()
    }
  });
});

// Add new custom folder to hierarchy
driveRouter.post('/folders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { parent_path, folder_name } = req.body;
  if (!parent_path || !folder_name) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'parent_path and folder_name are required' }
    });
  }

  try {
    const result = await DriveService.addFolder(parent_path, folder_name);
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'ADD_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: result.newFolder.id || result.newFolder.path,
      details: { folderName: folder_name, parentPath: parent_path, driveId: result.newFolder.driveFolderId }
    });
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Rename folder in hierarchy
driveRouter.patch('/folders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { folder_path, new_name } = req.body;
  if (!folder_path || !new_name) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'folder_path and new_name are required' }
    });
  }

  try {
    const result = await DriveService.renameFolder(folder_path, new_name);
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'RENAME_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: folder_path,
      details: { oldPath: folder_path, newName: new_name }
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Delete folder from hierarchy
driveRouter.delete('/folders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { folder_path } = req.body;
  if (!folder_path) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'folder_path is required' }
    });
  }

  try {
    const result = await DriveService.deleteFolder(folder_path);
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'DELETE_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: folder_path,
      details: { deletedPath: folder_path }
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Reset folder hierarchy to SAVISKAR 2026 default
driveRouter.post('/reset-structure', authMiddleware, requireRoles('MEDIA_COORDINATOR', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  const result = DriveService.resetStructure();
  AuditService.log({
    actorId: req.user!.id,
    actorName: req.user!.full_name,
    actorRole: req.user!.roles[0],
    action: 'RESET_DRIVE_STRUCTURE',
    entityType: 'EVENT',
    entityId: 'saviskar-2026',
    details: { resetAt: new Date().toISOString() }
  });
  res.json({ success: true, data: result });
});

// Sync and provision all folders directly in Google Drive cloud
driveRouter.post('/sync-folders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await DriveService.syncAllFoldersToGoogleDrive();
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'SYNC_GOOGLE_DRIVE_FOLDERS',
      entityType: 'EVENT',
      entityId: 'saviskar-2026',
      details: { syncedCount: result.syncedCount }
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Preview folder hierarchy (Dry run)
driveRouter.get('/preview-structure', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  const hierarchy = DriveService.getFolderStructure();

  res.json({
    success: true,
    data: hierarchy
  });
});

// Provision folder hierarchy (Coordinator/Admin only)
driveRouter.post('/provision-structure', authMiddleware, requireRoles('MEDIA_COORDINATOR', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { event_id, root_folder_url } = req.body;
  const targetEventId = event_id || db.events[0]?.id || 'saviskar-2026';

  try {
    const result = await DriveService.provisionFolderHierarchy(targetEventId, root_folder_url);

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'PROVISION_DRIVE_STRUCTURE',
      entityType: 'EVENT',
      entityId: targetEventId,
      details: { folderCount: result.createdFolders.length, rootFolderUrl: root_folder_url || config.google.rootFolderUrl }
    });

    res.status(201).json({
      success: true,
      data: {
        message: result.message,
        folders: result.createdFolders,
        rootFolderUrl: config.google.rootFolderUrl,
        rootFolderId: config.google.rootFolderId
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'PROVISION_FAILED', message: err.message || 'Failed to provision Drive hierarchy' }
    });
  }
});

// Validate Google Drive URL
driveRouter.post('/validate-url', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_URL', message: 'URL is required' }
    });
  }

  const validation = DriveService.validateDriveUrl(url);

  res.json({
    success: true,
    data: validation
  });
});
