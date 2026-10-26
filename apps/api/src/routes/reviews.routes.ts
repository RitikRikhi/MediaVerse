import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { db } from '../db/memoryStore';
import {
  AddReviewCommentSchema,
  ReviewDecisionSchema,
  ReviewComment,
  Approval
} from '@mediaverse/shared-types';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import { SupabaseService } from '../services/supabaseService';
import crypto from 'crypto';

export const reviewsRouter = Router();

// Get pending versions needing review
reviewsRouter.get('/pending', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const pendingProjects = db.editingProjects.filter(p => p.status === 'IN_REVIEW');
  const pendingVersions = db.editVersions.filter(v => 
    pendingProjects.some(p => p.id === v.editing_project_id)
  );

  res.json({
    success: true,
    data: {
      projects: pendingProjects,
      versions: pendingVersions
    }
  });
});

// Add a review comment to an edit version
reviewsRouter.post('/comments', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = AddReviewCommentSchema.parse(req.body);

    const version = db.editVersions.find(v => v.id === parsed.edit_version_id);
    if (!version) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Edit version not found' }
      });
    }

    const newComment: ReviewComment = {
      id: crypto.randomUUID(),
      edit_version_id: parsed.edit_version_id,
      reviewer_id: req.user!.id,
      reviewer_name: req.user!.full_name,
      timecode_seconds: parsed.timecode_seconds,
      comment: parsed.comment,
      is_resolved: false,
      created_at: new Date().toISOString()
    };

    db.reviewComments.push(newComment);
    await SupabaseService.persistReviewComment(newComment);

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'ADD_REVIEW_COMMENT',
      entityType: 'REVIEW_COMMENT',
      entityId: newComment.id,
      details: { timecode: parsed.timecode_seconds, versionId: parsed.edit_version_id }
    });

    // Notify editor who submitted this version
    if (version.submitted_by !== req.user!.id) {
      NotificationService.send({
        userId: version.submitted_by,
        title: 'New Review Comment',
        message: `${req.user!.full_name} commented on your edit version ${version.version_label}.`,
        type: 'REVIEW',
        linkUrl: '/editor'
      });
    }

    res.status(201).json({
      success: true,
      data: newComment
    });
  } catch (err) {
    next(err);
  }
});

// Submit review decision (Approve or Request Revision)
reviewsRouter.post(
  '/decision',
  authMiddleware,
  requireRoles('REVIEWER', 'MEDIA_COORDINATOR', 'SUPER_ADMIN', 'PRESIDENT'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { edit_version_id, is_final_delivery } = req.body;
      const parsed = ReviewDecisionSchema.parse(req.body);

      const version = db.editVersions.find(v => v.id === edit_version_id);
      if (!version) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Edit version not found' }
        });
      }

      const project = db.editingProjects.find(p => p.id === version.editing_project_id);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Associated editing project not found' }
        });
      }

      const approval: Approval = {
        id: crypto.randomUUID(),
        editing_project_id: project.id,
        edit_version_id: version.id,
        reviewer_id: req.user!.id,
        reviewer_name: req.user!.full_name,
        decision: parsed.decision,
        feedback: parsed.feedback,
        created_at: new Date().toISOString()
      };

      db.approvals.push(approval);
      await SupabaseService.persistApproval(approval);

      // Update statuses
      const assignment = db.assignments.find(a => a.id === project.assignment_id);

      if (parsed.decision === 'APPROVED') {
        const nextStatus = is_final_delivery ? 'DELIVERED' : 'APPROVED';
        project.status = nextStatus;
        project.updated_at = new Date().toISOString();

        if (assignment) {
          assignment.status = nextStatus;
          assignment.updated_at = new Date().toISOString();
        }

        AuditService.log({
          actorId: req.user!.id,
          actorName: req.user!.full_name,
          actorRole: req.user!.roles[0],
          action: 'APPROVE_EDIT_VERSION',
          entityType: 'APPROVAL',
          entityId: approval.id,
          details: { project: project.title, feedback: parsed.feedback }
        });

        // Notify editor
        NotificationService.send({
          userId: version.submitted_by,
          title: is_final_delivery ? 'Deliverable Finalized!' : 'Edit Version Approved!',
          message: `Your cut ${version.version_label} has been approved by ${req.user!.full_name}.`,
          type: 'APPROVAL',
          linkUrl: '/editor'
        });
      } else {
        project.status = 'REVISION_REQUIRED';
        project.updated_at = new Date().toISOString();

        if (assignment) {
          assignment.status = 'IN_REVIEW';
          assignment.updated_at = new Date().toISOString();
        }

        AuditService.log({
          actorId: req.user!.id,
          actorName: req.user!.full_name,
          actorRole: req.user!.roles[0],
          action: 'REVISE_EDIT_VERSION',
          entityType: 'APPROVAL',
          entityId: approval.id,
          details: { project: project.title, feedback: parsed.feedback }
        });

        // Notify editor
        NotificationService.send({
          userId: version.submitted_by,
          title: 'Revisions Requested',
          message: `${req.user!.full_name} requested revisions on ${version.version_label}: "${parsed.feedback.slice(0, 80)}..."`,
          type: 'REVIEW',
          linkUrl: '/editor'
        });
      }

      res.status(201).json({
        success: true,
        data: {
          approval,
          project_status: project.status
        }
      });
    } catch (err) {
      next(err);
    }
  }
);
