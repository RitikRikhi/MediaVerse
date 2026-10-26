import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { db } from '../db/memoryStore';
import { SubmitEditVersionSchema, EditingProject, EditVersion } from '@mediaverse/shared-types';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import { SupabaseService } from '../services/supabaseService';
import { DriveService } from '../services/driveService';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

export const editingRouter = Router();

// Configure disk storage for real chunked/multipart file uploads of edited video cuts
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
    fileSize: 1024 * 1024 * 1024 * 12 // Up to 12GB per edited video cut
  }
});

// Helper to enrich editing project
function enrichProject(project: EditingProject): EditingProject {
  const versions = db.editVersions
    .filter(v => v.editing_project_id === project.id)
    .sort((a, b) => b.version_number - a.version_number)
    .map(v => {
      const comments = db.reviewComments.filter(c => c.edit_version_id === v.id);
      const approvals = db.approvals.filter(a => a.edit_version_id === v.id);
      return {
        ...v,
        comments,
        approvals
      };
    });

  const editor = db.profiles.find(p => p.id === project.assigned_editor_id);
  const assignment = db.assignments.find(a => a.id === project.assignment_id);

  return {
    ...project,
    assigned_editor_name: editor?.full_name,
    assignment_title: assignment?.title,
    versions
  };
}

// List editing projects
editingRouter.get('/projects', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { event_id, status, assigned_editor_id } = req.query;

  let list = [...db.editingProjects];

  if (event_id) {
    list = list.filter(p => p.event_id === event_id);
  }
  if (status) {
    list = list.filter(p => p.status === status);
  }
  if (assigned_editor_id) {
    list = list.filter(p => p.assigned_editor_id === assigned_editor_id);
  }

  const enriched = list.map(enrichProject);

  res.json({
    success: true,
    data: enriched
  });
});

// Get single project
editingRouter.get('/projects/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const project = db.editingProjects.find(p => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Editing project not found' }
    });
  }

  res.json({
    success: true,
    data: enrichProject(project)
  });
});

// Create new editing project
editingRouter.post('/projects', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { assignment_id, event_id, title, brief, aspect_ratio, deliverable_specs, assigned_editor_id, priority, deadline } = req.body;

  if (!title || !brief) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Title and creative brief are required.' }
    });
  }

  const targetAssignmentId = assignment_id || db.assignments[0]?.id || crypto.randomUUID();

  const newProject: EditingProject = {
    id: crypto.randomUUID(),
    assignment_id: targetAssignmentId,
    event_id: event_id || db.events[0]?.id,
    title,
    brief,
    aspect_ratio: aspect_ratio || '16:9',
    deliverable_specs: deliverable_specs || '1080p MP4 H.264',
    assigned_editor_id: assigned_editor_id || req.user!.id,
    priority: priority || 'MEDIUM',
    status: 'EDITING',
    deadline: deadline || new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.editingProjects.push(newProject);

  // Transition the assignment to EDITING
  const assignment = db.assignments.find(a => a.id === targetAssignmentId);
  if (assignment && ['AVAILABLE_FOR_EDITING', 'ASSIGNED'].includes(assignment.status)) {
    assignment.status = 'EDITING';
    assignment.updated_at = new Date().toISOString();
  }

  await SupabaseService.persistEditingProject(newProject);

  AuditService.log({
    actorId: req.user!.id,
    actorName: req.user!.full_name,
    actorRole: req.user!.roles[0],
    action: 'CREATE_EDITING_PROJECT',
    entityType: 'EDITING_PROJECT',
    entityId: newProject.id,
    details: { title: newProject.title, editor: req.user!.full_name }
  });

  res.status(201).json({
    success: true,
    data: enrichProject(newProject)
  });
});

// Real Direct File Upload for Editors (Streams edited video/reel directly to Google Drive)
editingRouter.post(
  '/projects/:id/upload-version',
  authMiddleware,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    const project = db.editingProjects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Editing project not found' }
      });
    }

    const file = req.file;
    const {
      version_label,
      notes = '',
      target_folder_id,
      target_folder_path
    } = req.body;

    let driveWebUrl = req.body.drive_web_url;
    let driveThumbnailUrl: string | undefined;
    let driveFolderTarget = target_folder_path || '/DSA MEDIAVERSE SAVISKAR 26/Reels & Edits/In Review Cuts';

    if (file) {
      try {
        const driveUpload = await DriveService.uploadFileToDrive({
          filePath: file.path,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          targetFolderId: target_folder_id,
          targetFolderPath: driveFolderTarget
        });
        driveWebUrl = driveUpload.webViewLink;
        driveThumbnailUrl = driveUpload.thumbnailLink;
        driveFolderTarget = driveUpload.folderPath;

        // Clean up temporary local file
        try { fs.unlinkSync(file.path); } catch {}
      } catch (uploadErr: any) {
        try { if (file.path) fs.unlinkSync(file.path); } catch {}
        return res.status(500).json({
          success: false,
          error: { code: 'DRIVE_UPLOAD_FAILED', message: uploadErr.message || 'Failed to upload edit to Google Drive' }
        });
      }
    }

    if (!driveWebUrl) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_MEDIA', message: 'Either an edit video file or a Google Drive link must be provided.' }
      });
    }

    const existingVersions = db.editVersions.filter(v => v.editing_project_id === project.id);
    const nextVersionNumber = existingVersions.length + 1;
    const label = version_label?.trim() || `v${nextVersionNumber} Cut`;

    const newVersion: EditVersion = {
      id: crypto.randomUUID(),
      editing_project_id: project.id,
      version_number: nextVersionNumber,
      version_label: label,
      drive_web_url: driveWebUrl,
      preview_url: req.body.preview_url || driveThumbnailUrl,
      notes,
      submitted_by: req.user!.id,
      submitted_by_name: req.user!.full_name,
      submitted_at: new Date().toISOString()
    };

    db.editVersions.push(newVersion);
    await SupabaseService.persistEditVersion(newVersion);

    project.status = 'IN_REVIEW';
    project.updated_at = new Date().toISOString();

    const assignment = db.assignments.find(a => a.id === project.assignment_id);
    if (assignment) {
      assignment.status = 'IN_REVIEW';
      assignment.updated_at = new Date().toISOString();
    }

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'UPLOAD_EDIT_VERSION_TO_DRIVE',
      entityType: 'EDIT_VERSION',
      entityId: newVersion.id,
      details: {
        projectId: project.id,
        projectTitle: project.title,
        versionLabel: newVersion.version_label,
        driveWebUrl: newVersion.drive_web_url,
        driveFolder: driveFolderTarget,
        editor: req.user!.full_name
      }
    });

    NotificationService.broadcastToRoles(['REVIEWER', 'MEDIA_COORDINATOR'], {
      title: 'New Edit Version Ready for Review',
      message: `${req.user!.full_name} uploaded ${newVersion.version_label} for "${project.title}" to Google Drive.`,
      type: 'REVIEW',
      linkUrl: `/reviews`
    });

    res.status(201).json({
      success: true,
      data: newVersion
    });
  }
);

// Submit edit version (v1, v2, vFinal)
editingRouter.post('/projects/:id/versions', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const project = db.editingProjects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Editing project not found' }
      });
    }

    const parsed = SubmitEditVersionSchema.parse({
      editing_project_id: project.id,
      ...req.body
    });

    // Calculate next version number
    const existingVersions = db.editVersions.filter(v => v.editing_project_id === project.id);
    const nextVersionNumber = existingVersions.length + 1;

    const newVersion: EditVersion = {
      id: crypto.randomUUID(),
      editing_project_id: project.id,
      version_number: nextVersionNumber,
      version_label: parsed.version_label,
      drive_web_url: parsed.drive_web_url,
      preview_url: parsed.preview_url,
      notes: parsed.notes,
      submitted_by: req.user!.id,
      submitted_by_name: req.user!.full_name,
      submitted_at: new Date().toISOString()
    };

    db.editVersions.push(newVersion);
    await SupabaseService.persistEditVersion(newVersion);

    // Update project & assignment status to IN_REVIEW
    project.status = 'IN_REVIEW';
    project.updated_at = new Date().toISOString();

    const assignment = db.assignments.find(a => a.id === project.assignment_id);
    if (assignment) {
      assignment.status = 'IN_REVIEW';
      assignment.updated_at = new Date().toISOString();
    }

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'SUBMIT_EDIT_VERSION',
      entityType: 'EDIT_VERSION',
      entityId: newVersion.id,
      details: { versionNumber: nextVersionNumber, label: newVersion.version_label, project: project.title }
    });

    // Notify Reviewers and Coordinators
    NotificationService.broadcastToRoles(['REVIEWER', 'MEDIA_COORDINATOR'], {
      title: 'New Edit Version Ready for Review',
      message: `${req.user!.full_name} submitted ${newVersion.version_label} for "${project.title}".`,
      type: 'REVIEW',
      linkUrl: `/editor`
    });

    res.status(201).json({
      success: true,
      data: newVersion
    });
  } catch (err) {
    next(err);
  }
});
