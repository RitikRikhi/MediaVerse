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

// ==========================================
// User Personal Drive Endpoints
// ==========================================

// Get or auto-provision personal drive for current logged-in user
driveRouter.get('/my-drive', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const personalDrive = await DriveService.getUserPersonalDrive(req.user!);
    res.json({
      success: true,
      data: personalDrive
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'PERSONAL_DRIVE_FAILED', message: err.message || 'Failed to retrieve personal drive' }
    });
  }
});

// Get interactive master tree + personal tree in a unified payload
driveRouter.get('/tree', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const masterTree = DriveService.getMasterFolderTree(req.user);
    const personalDrive = await DriveService.getUserPersonalDrive(req.user!);
    res.json({
      success: true,
      data: {
        masterTree,
        personalDrive
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DRIVE_TREE_FAILED', message: err.message || 'Failed to retrieve folder tree' }
    });
  }
});

// Add a subfolder to ANY folder in the tree (official categories or personal vaults)
driveRouter.post('/folders/add-subfolder', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { folderName, parentId, parentPath } = req.body;
  if (!folderName || !folderName.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'folderName is required' }
    });
  }

  try {
    const result = await DriveService.addSubfolderToAnyNode({
      user: req.user!,
      folderName: folderName.trim(),
      parentFolderId: parentId,
      parentPath
    });

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'ADD_SUBFOLDER',
      entityType: 'FOLDER',
      entityId: result.driveFolderId,
      details: { folderName, parentId, path: result.path }
    });

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'ADD_SUBFOLDER_FAILED', message: err.message || 'Failed to add subfolder' }
    });
  }
});

// Configure personal drive: role-specific event list OR full festival directory
driveRouter.post('/my-drive/setup', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { role, structureMode, customEmail } = req.body;

  try {
    const result = await DriveService.setupUserPersonalDrive(req.user!, {
      role: role || req.user!.roles[0],
      structureMode: structureMode || 'ROLE_SPECIFIC',
      customEmail
    });

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'SETUP_PERSONAL_DRIVE',
      entityType: 'FOLDER',
      entityId: result.personalRootFolderId,
      details: { structureMode, role, subfolderCount: result.subfolders.length }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'SETUP_PERSONAL_DRIVE_FAILED', message: err.message || 'Failed to setup personal drive' }
    });
  }
});

// Add a custom subfolder inside user's personal drive
driveRouter.post('/my-drive/folders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { folderName, parentFolderId } = req.body;
  if (!folderName || !folderName.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'folderName is required' }
    });
  }

  try {
    const createdSubfolder = await DriveService.addUserPersonalSubfolder(
      req.user!,
      folderName.trim(),
      parentFolderId
    );

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'CREATE_PERSONAL_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: createdSubfolder.driveFolderId,
      details: { folderName, path: createdSubfolder.path }
    });

    res.status(201).json({
      success: true,
      data: createdSubfolder
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_SUBFOLDER_FAILED', message: err.message || 'Failed to create subfolder' }
    });
  }
});

// Rename a personal subfolder
driveRouter.patch('/my-drive/folders/:folderId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { newName } = req.body;
  const { folderId } = req.params;

  if (!newName || !newName.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'newName is required' }
    });
  }

  try {
    const updated = await DriveService.renameUserPersonalSubfolder(
      req.user!,
      folderId,
      newName.trim()
    );

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'RENAME_PERSONAL_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: folderId,
      details: { newName: newName.trim(), path: updated.path }
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'RENAME_SUBFOLDER_FAILED', message: err.message || 'Failed to rename folder' }
    });
  }
});

// Delete a custom personal subfolder
driveRouter.delete('/my-drive/folders/:folderId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { folderId } = req.params;

  try {
    const result = await DriveService.deleteUserPersonalSubfolder(req.user!, folderId);

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'DELETE_PERSONAL_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: folderId,
      details: { deletedAt: new Date().toISOString() }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'DELETE_SUBFOLDER_FAILED', message: err.message || 'Failed to delete folder' }
    });
  }
});

// ==========================================
// Super Admin Member Gmail-Wise Drives
// ==========================================

// 1. List all member drives (Super Admin / Coordinator)
driveRouter.get('/member-drives', authMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const list = DriveService.getAllMemberDrives();
    res.json({
      success: true,
      data: list
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'MEMBER_DRIVES_FAILED', message: err.message || 'Failed to retrieve member drives' }
    });
  }
});

// 2. Create drive for any member Gmail (Super Admin / Coordinator)
driveRouter.post('/member-drives', authMiddleware, requireRoles('SUPER_ADMIN', 'MEDIA_COORDINATOR', 'PRESIDENT'), async (req: AuthenticatedRequest, res: Response) => {
  const { memberEmail, memberName, role, customSubfolders } = req.body;

  if (!memberEmail || !memberName) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'memberEmail and memberName are required' }
    });
  }

  try {
    const createdDrive = await DriveService.createMemberDriveForGmail({
      adminUser: req.user!,
      memberEmail,
      memberName,
      role: role || 'PHOTOGRAPHER',
      customSubfolders
    });

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'CREATE_MEMBER_GMAIL_DRIVE',
      entityType: 'FOLDER',
      entityId: createdDrive.driveFolderId,
      details: {
        memberEmail,
        memberName,
        role,
        driveUrl: createdDrive.driveWebUrl,
        subfoldersCount: createdDrive.subfolders.length
      }
    });

    res.status(201).json({
      success: true,
      data: createdDrive
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_MEMBER_DRIVE_FAILED', message: err.message || 'Failed to create member drive' }
    });
  }
});

// 3. Get single member drive details
driveRouter.get('/member-drives/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const drive = DriveService.getMemberDriveById(req.params.id);
  if (!drive) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Member drive not found' }
    });
  }
  res.json({
    success: true,
    data: drive
  });
});

// 4. Add subfolder inside a member's drive
driveRouter.post('/member-drives/:id/subfolders', authMiddleware, requireRoles('SUPER_ADMIN', 'MEDIA_COORDINATOR', 'PRESIDENT'), async (req: AuthenticatedRequest, res: Response) => {
  const { folderName, parentFolderId } = req.body;
  if (!folderName || !folderName.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'folderName is required' }
    });
  }

  try {
    const subfolder = await DriveService.addMemberDriveSubfolder(req.params.id, folderName.trim(), parentFolderId);
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'ADD_MEMBER_DRIVE_SUBFOLDER',
      entityType: 'FOLDER',
      entityId: subfolder.driveFolderId,
      details: { memberDriveId: req.params.id, folderName }
    });
    res.status(201).json({ success: true, data: subfolder });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// 5. Rename a folder/subfolder inside a member's drive
driveRouter.patch('/member-drives/:id/folders/:folderId', authMiddleware, requireRoles('SUPER_ADMIN', 'MEDIA_COORDINATOR', 'PRESIDENT'), async (req: AuthenticatedRequest, res: Response) => {
  const { newName } = req.body;
  if (!newName || !newName.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'newName is required' }
    });
  }

  try {
    const updated = await DriveService.renameMemberDriveFolder(req.params.id, req.params.folderId, newName.trim());
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'RENAME_MEMBER_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: req.params.folderId,
      details: { memberDriveId: req.params.id, newName }
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// 6. Delete a subfolder inside a member's drive
driveRouter.delete('/member-drives/:id/folders/:folderId', authMiddleware, requireRoles('SUPER_ADMIN', 'MEDIA_COORDINATOR', 'PRESIDENT'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await DriveService.deleteMemberDriveFolder(req.params.id, req.params.folderId);
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'DELETE_MEMBER_DRIVE_FOLDER',
      entityType: 'FOLDER',
      entityId: req.params.folderId,
      details: { memberDriveId: req.params.id }
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ==========================================
// Unified Node Rename & Delete across All Views
// ==========================================

// Rename ANY folder node (master hierarchy, member drives, or custom)
driveRouter.patch('/folders/rename-node', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { folderId, folderPath, newName } = req.body;
  if (!newName || !newName.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'newName is required' }
    });
  }

  try {
    const result = await DriveService.renameAnyFolderNode({
      folderId,
      folderPath,
      newName: newName.trim()
    });

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'RENAME_FOLDER_NODE',
      entityType: 'FOLDER',
      entityId: folderId || folderPath,
      details: { newName: newName.trim(), folderPath }
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// Delete ANY folder node
driveRouter.delete('/folders/delete-node', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { folderId, folderPath } = req.body;
  if (!folderId && !folderPath) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'folderId or folderPath is required' }
    });
  }

  try {
    const result = await DriveService.deleteAnyFolderNode({ folderId, folderPath });
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'DELETE_FOLDER_NODE',
      entityType: 'FOLDER',
      entityId: folderId || folderPath,
      details: { folderPath }
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { message: err.message } });
  }
});

// ==========================================
// Super Admin Data Transfer Engine
// ==========================================
driveRouter.post('/transfer', authMiddleware, requireRoles('SUPER_ADMIN', 'MEDIA_COORDINATOR', 'PRESIDENT'), async (req: AuthenticatedRequest, res: Response) => {
  const { assetIds, sourceFolderId, targetFolderId, targetFolderPath, newCategory } = req.body;

  if (!targetFolderId) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'targetFolderId is required' }
    });
  }

  try {
    const result = await DriveService.transferMediaData({
      assetIds,
      sourceFolderId,
      targetFolderId,
      targetFolderPath,
      newCategory
    });

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'TRANSFER_MEDIA_DATA',
      entityType: 'MEDIA',
      entityId: targetFolderId,
      details: {
        transferredCount: result.transferredCount,
        targetFolderPath,
        newCategory
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { code: 'TRANSFER_FAILED', message: err.message || 'Media transfer failed' }
    });
  }
});
