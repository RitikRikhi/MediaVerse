import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { db } from '../db/memoryStore';
import { RegisterMediaAssetSchema, MediaAsset } from '@mediaverse/shared-types';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import { DriveService } from '../services/driveService';
import { SupabaseService } from '../services/supabaseService';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const mediaRouter = Router();

// Configure disk storage for real chunked/multipart file uploads (prevents RAM blowup)
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 * 12 // Up to 12GB per file
  }
});

// List / Search Media Assets
mediaRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { event_id, assignment_id, media_type, search, uploader_id, day } = req.query;

  let list = [...db.mediaAssets];

  if (event_id) {
    list = list.filter(m => m.event_id === event_id);
  }
  if (assignment_id) {
    list = list.filter(m => m.assignment_id === assignment_id);
  }
  if (media_type) {
    list = list.filter(m => m.media_type === media_type);
  }
  if (uploader_id) {
    list = list.filter(m => m.uploader_id === uploader_id);
  }
  if (day) {
    const dayStr = String(day).toLowerCase();
    list = list.filter(m => {
      const assignment = db.assignments.find(a => a.id === m.assignment_id);
      return assignment?.day_session.toLowerCase().includes(dayStr);
    });
  }
  if (search) {
    const query = String(search).toLowerCase();
    list = list.filter(
      m =>
        m.filename.toLowerCase().includes(query) ||
        (m.description && m.description.toLowerCase().includes(query)) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(query)))
    );
  }

  // Sort by newest first
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({
    success: true,
    data: list
  });
});

// 1. Direct Browser-to-Drive: Create Resumable Upload Session
mediaRouter.post('/upload-session', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      filename,
      fileSizeBytes,
      mimeType,
      targetFolderId,
      targetFolderPath,
      assignmentId,
      eventId,
      mediaType = 'RAW_PHOTO',
      description
    } = req.body;

    if (!filename || !fileSizeBytes || !mimeType) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'filename, fileSizeBytes, and mimeType are required to initiate an upload session.' }
      });
    }

    const targetAssignment = assignmentId ? db.assignments.find(a => a.id === assignmentId) : undefined;
    const destination = DriveService.resolveDestination(targetAssignment?.day_session, mediaType);

    const session = await DriveService.createResumableUploadSession({
      filename,
      mimeType,
      sizeBytes: Number(fileSizeBytes),
      targetFolderId,
      targetFolderPath,
      description,
      destination
    });

    res.json({
      success: true,
      data: session
    });
  } catch (err: any) {
    console.error('[Upload Session Error]', err);
    const isAuthError = err.message?.includes('GOOGLE_DRIVE_NOT_CONNECTED') || err.message?.includes('not connected');
    res.status(isAuthError ? 401 : 500).json({
      success: false,
      error: {
        code: isAuthError ? 'GOOGLE_DRIVE_NOT_CONNECTED' : 'SESSION_INIT_FAILED',
        message: err.message || 'Failed to initialize Google Drive upload session',
        authUrl: isAuthError ? DriveService.getOAuthUrl() : undefined
      }
    });
  }
});

// 2. Direct Browser-to-Drive: Finalize Upload & Persist to Supabase
mediaRouter.post('/upload-complete', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      driveFileId,
      filename,
      fileSizeBytes,
      mimeType,
      driveWebUrl,
      driveThumbnailUrl,
      assignmentId,
      eventId,
      mediaType = 'RAW_PHOTO',
      targetFolderId,
      targetFolderPath,
      description = '',
      tags = ''
    } = req.body;

    if (!driveFileId || !filename) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'driveFileId and filename are required.' }
      });
    }

    // Duplicate check: check if asset with this drive_file_id already registered
    const existing = db.mediaAssets.find(m => m.drive_file_id === driveFileId);
    if (existing) {
      return res.json({
        success: true,
        data: {
          asset: existing,
          destination: {
            fullPath: targetFolderPath || 'SAVISKAR 2026',
            folderName: targetFolderPath || 'SAVISKAR 2026',
            driveFolderId: targetFolderId,
            driveFolderUrl: targetFolderId ? `https://drive.google.com/drive/folders/${targetFolderId}` : existing.drive_web_url
          },
          message: 'Asset was already registered.'
        }
      });
    }

    const targetAssignment = assignmentId ? db.assignments.find(a => a.id === assignmentId) : undefined;
    const targetEventId = eventId || targetAssignment?.event_id || db.events[0]?.id;

    const parsedTags = typeof tags === 'string'
      ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : Array.isArray(tags) ? tags : [];

    const newAsset: MediaAsset = {
      id: crypto.randomUUID(),
      event_id: targetEventId,
      assignment_id: assignmentId,
      assignment_title: targetAssignment?.title,
      uploader_id: req.user!.id,
      uploader_name: req.user!.full_name,
      filename,
      media_type: mediaType,
      drive_file_id: driveFileId,
      drive_web_url: driveWebUrl || `https://drive.google.com/file/d/${driveFileId}/view`,
      drive_thumbnail_url: driveThumbnailUrl || (mediaType.includes('VIDEO')
        ? 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=300'
        : 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=300'),
      file_size_bytes: Number(fileSizeBytes) || 0,
      mime_type: mimeType,
      capture_time: new Date().toISOString(),
      description,
      tags: parsedTags,
      is_verified: true,
      created_at: new Date().toISOString()
    };

    db.mediaAssets.push(newAsset);
    await SupabaseService.persistMediaAsset(newAsset);

    // Advance assignment status if in progress
    if (targetAssignment) {
      if (targetAssignment.status === 'ASSIGNED' || targetAssignment.status === 'CAPTURING') {
        targetAssignment.status = 'AVAILABLE_FOR_EDITING';
        targetAssignment.updated_at = new Date().toISOString();
      }
    }

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'DIRECT_DRIVE_UPLOAD_COMPLETE',
      entityType: 'MEDIA_ASSET',
      entityId: newAsset.id,
      details: {
        filename: newAsset.filename,
        sizeBytes: newAsset.file_size_bytes,
        driveFolder: targetFolderPath,
        driveFolderId: targetFolderId,
        assignmentId: newAsset.assignment_id
      }
    });

    NotificationService.broadcastToRoles(['VIDEO_EDITOR', 'MEDIA_COORDINATOR'], {
      title: 'New Media Ready in Drive',
      message: `${req.user!.full_name} uploaded "${newAsset.filename}" directly to Google Drive for ${targetAssignment?.title || 'SAVISKAR 2026'}.`,
      type: 'UPLOAD',
      linkUrl: '/media'
    });

    res.status(201).json({
      success: true,
      data: {
        asset: newAsset,
        destination: {
          fullPath: targetFolderPath,
          folderName: targetFolderPath,
          driveFolderId: targetFolderId,
          driveFolderUrl: `https://drive.google.com/drive/folders/${targetFolderId}`
        },
        message: `Successfully uploaded ${newAsset.filename} directly to Google Drive`
      }
    });
  } catch (err: any) {
    console.error('[Upload Complete Error]', err);
    res.status(500).json({
      success: false,
      error: { code: 'SAVE_FAILED', message: err.message || 'Failed to complete media upload registration' }
    });
  }
});

// Real Automated File Upload (Photographer / Videographer direct upload to Google Drive)
mediaRouter.post(
  '/upload',
  authMiddleware,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file;
    try {
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file was provided in the upload request.' }
        });
      }

      const {
        assignment_id,
        event_id,
        media_type = 'RAW_PHOTO',
        description = '',
        tags = '',
        target_folder_id,
        target_folder_path
      } = req.body;

      const targetAssignment = assignment_id ? db.assignments.find(a => a.id === assignment_id) : undefined;
      const targetEventId = event_id || targetAssignment?.event_id || db.events[0]?.id;

      // Automatically determine the default Google Drive folder based on assignment & media type
      const destination = DriveService.resolveDestination(targetAssignment?.day_session, media_type);

      // Upload/stream to Google Drive into either user-selected folder or auto-resolved category
      const driveUpload = await DriveService.uploadFileToDrive({
        filePath: file.path,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        destination,
        targetFolderId: target_folder_id,
        targetFolderPath: target_folder_path
      });

      const parsedTags = typeof tags === 'string'
        ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : Array.isArray(tags) ? tags : [];

      const newAsset: MediaAsset = {
        id: crypto.randomUUID(),
        event_id: targetEventId,
        assignment_id,
        assignment_title: targetAssignment?.title,
        uploader_id: req.user!.id,
        uploader_name: req.user!.full_name,
        filename: file.originalname,
        media_type,
        drive_file_id: driveUpload.fileId,
        drive_web_url: driveUpload.webViewLink,
        drive_thumbnail_url: driveUpload.thumbnailLink || (media_type.includes('VIDEO')
          ? 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=300'
          : 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=300'),
        file_size_bytes: file.size,
        mime_type: file.mimetype,
        capture_time: new Date().toISOString(),
        description,
        tags: parsedTags,
        is_verified: true,
        created_at: new Date().toISOString()
      };

      db.mediaAssets.push(newAsset);
      await SupabaseService.persistMediaAsset(newAsset);

      // Automatically advance status of assignment if in progress
      if (targetAssignment) {
        if (targetAssignment.status === 'ASSIGNED' || targetAssignment.status === 'CAPTURING') {
          targetAssignment.status = 'AVAILABLE_FOR_EDITING';
          targetAssignment.updated_at = new Date().toISOString();
        }
      }

      AuditService.log({
        actorId: req.user!.id,
        actorName: req.user!.full_name,
        actorRole: req.user!.roles[0],
        action: 'UPLOAD_MEDIA_TO_DRIVE',
        entityType: 'MEDIA_ASSET',
        entityId: newAsset.id,
        details: {
          filename: newAsset.filename,
          sizeBytes: file.size,
          driveFolder: driveUpload.folderPath,
          driveFolderId: driveUpload.driveFolderId,
          assignmentId: newAsset.assignment_id
        }
      });

      // Notify video editors and coordinators
      NotificationService.broadcastToRoles(['VIDEO_EDITOR', 'MEDIA_COORDINATOR'], {
        title: 'New Media Ready in Drive',
        message: `${req.user!.full_name} uploaded "${newAsset.filename}" to ${driveUpload.folderPath} for ${targetAssignment?.title || 'SAVISKAR 2026'}.`,
        type: 'UPLOAD',
        linkUrl: '/media'
      });

      res.status(201).json({
        success: true,
        data: {
          asset: newAsset,
          destination: {
            fullPath: driveUpload.folderPath,
            folderName: driveUpload.folderPath,
            driveFolderId: driveUpload.driveFolderId,
            driveFolderUrl: driveUpload.driveFolderUrl
          },
          message: `Successfully uploaded ${newAsset.filename} to ${driveUpload.folderPath}`
        }
      });
    } catch (err: any) {
      if (file && fs.existsSync(file.path)) {
        try { await fs.promises.unlink(file.path); } catch {}
      }
      console.error('[Media Upload Error]', err);
      const isAuthError = err.message?.includes('GOOGLE_DRIVE_NOT_CONNECTED') || err.message?.includes('not connected');
      res.status(isAuthError ? 401 : 500).json({
        success: false,
        error: {
          code: isAuthError ? 'GOOGLE_DRIVE_NOT_CONNECTED' : 'UPLOAD_FAILED',
          message: err.message || 'File upload failed',
          authUrl: isAuthError ? DriveService.getOAuthUrl() : undefined
        }
      });
    }
  }
);

// Register pre-existing Drive asset (manual link registration)
mediaRouter.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = RegisterMediaAssetSchema.parse(req.body);

  const duplicate = db.mediaAssets.find(
    m => m.drive_web_url === parsed.drive_web_url || (parsed.drive_file_id && m.drive_file_id === parsed.drive_file_id)
  );

  if (duplicate) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_FILE',
        message: `This Drive asset is already registered under "${duplicate.filename}".`
      }
    });
  }

  let assignmentTitle: string | undefined;
  if (parsed.assignment_id) {
    const assignment = db.assignments.find(a => a.id === parsed.assignment_id);
    if (assignment) {
      assignmentTitle = assignment.title;
      if (assignment.status === 'CAPTURING' || assignment.status === 'ASSIGNED') {
        assignment.status = 'AVAILABLE_FOR_EDITING';
        assignment.updated_at = new Date().toISOString();
      }
    }
  }

  const defaultThumbnails: Record<string, string> = {
    RAW_PHOTO: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=300',
    RAW_VIDEO: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=300',
    FINAL_VIDEO: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300',
    EDITED_DRAFT: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=300'
  };

  const newAsset: MediaAsset = {
    id: crypto.randomUUID(),
    event_id: parsed.event_id,
    assignment_id: parsed.assignment_id,
    assignment_title: assignmentTitle,
    uploader_id: req.user!.id,
    uploader_name: req.user!.full_name,
    filename: parsed.filename,
    media_type: parsed.media_type,
    drive_file_id: parsed.drive_file_id,
    drive_web_url: parsed.drive_web_url,
    drive_thumbnail_url: defaultThumbnails[parsed.media_type] || defaultThumbnails.RAW_PHOTO,
    file_size_bytes: parsed.file_size_bytes,
    mime_type: parsed.media_type.includes('VIDEO') ? 'video/mp4' : 'image/jpeg',
    capture_time: new Date().toISOString(),
    description: parsed.description,
    tags: parsed.tags || [],
    is_verified: true,
    created_at: new Date().toISOString()
  };

  db.mediaAssets.push(newAsset);
  await SupabaseService.persistMediaAsset(newAsset);

  AuditService.log({
    actorId: req.user!.id,
    actorName: req.user!.full_name,
    actorRole: req.user!.roles[0],
    action: 'REGISTER_MEDIA',
    entityType: 'MEDIA_ASSET',
    entityId: newAsset.id,
    details: { filename: newAsset.filename, type: newAsset.media_type, assignmentId: newAsset.assignment_id }
  });

  NotificationService.broadcastToRoles(['VIDEO_EDITOR', 'MEDIA_COORDINATOR'], {
    title: 'New Media Registered',
    message: `${req.user!.full_name} registered "${newAsset.filename}" (${newAsset.media_type}) for ${assignmentTitle || 'Event'}.`,
    type: 'UPLOAD',
    linkUrl: '/media'
  });

  res.status(201).json({
    success: true,
    data: newAsset
  });
});
