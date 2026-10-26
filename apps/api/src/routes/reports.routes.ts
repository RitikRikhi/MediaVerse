import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { db } from '../db/memoryStore';
import { CoordinatorMetrics } from '@mediaverse/shared-types';

export const reportsRouter = Router();

reportsRouter.get('/metrics', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const eventId = req.query.event_id as string;
  let assignments = [...db.assignments];
  if (eventId) {
    assignments = assignments.filter(a => a.event_id === eventId);
  }

  const now = new Date();

  const metrics: CoordinatorMetrics = {
    total_assignments: assignments.length,
    assigned: assignments.filter(a => a.status === 'ASSIGNED').length,
    capturing: assignments.filter(a => a.status === 'CAPTURING').length,
    upload_pending: assignments.filter(a => a.status === 'UPLOAD_PENDING').length,
    available_for_editing: assignments.filter(a => a.status === 'AVAILABLE_FOR_EDITING').length,
    editing: assignments.filter(a => a.status === 'EDITING').length,
    in_review: assignments.filter(a => a.status === 'IN_REVIEW').length,
    revision_required: assignments.filter(a => a.status === 'REVISION_REQUIRED').length,
    approved: assignments.filter(a => a.status === 'APPROVED').length,
    delivered: assignments.filter(a => a.status === 'DELIVERED').length,
    overdue: assignments.filter(
      a => !['APPROVED', 'DELIVERED'].includes(a.status) && new Date(a.deadline) < now
    ).length,
    total_registered_assets: db.mediaAssets.length,
    total_active_crew: db.profiles.filter(p => p.is_active).length
  };

  res.json({
    success: true,
    data: metrics
  });
});

// Operational data export (JSON or CSV)
reportsRouter.get('/export', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';

  const exportData = {
    generated_at: new Date().toISOString(),
    event: db.events[0],
    assignments: db.assignments,
    media_assets: db.mediaAssets,
    editing_projects: db.editingProjects,
    edit_versions: db.editVersions,
    activity_logs: db.activityLogs
  };

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="saviskar-2026-mediaverse-export.json"');
    return res.send(JSON.stringify(exportData, null, 2));
  }

  // Simple CSV export of assignments
  const csvHeaders = 'ID,Title,CoverageType,Priority,Status,DaySession,Deadline,DriveFolderUrl\n';
  const csvRows = db.assignments
    .map(
      a =>
        `"${a.id}","${a.title.replace(/"/g, '""')}","${a.coverage_type}","${a.priority}","${a.status}","${a.day_session}","${a.deadline}","${a.drive_folder_url || ''}"`
    )
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="saviskar-2026-assignments.csv"');
  res.send(csvHeaders + csvRows);
});
