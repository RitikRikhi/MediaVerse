import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { requireRoles } from '../middleware/rbac';
import { db } from '../db/memoryStore';
import {
  CreateAssignmentSchema,
  UpdateAssignmentStatusSchema,
  VALID_STATUS_TRANSITIONS,
  ROLE_TRANSITION_PERMISSIONS,
  Assignment,
  AssignmentStatus,
  UserRole
} from '@mediaverse/shared-types';
import { AuditService } from '../services/auditService';
import { NotificationService } from '../services/notificationService';
import { SupabaseService } from '../services/supabaseService';
import crypto from 'crypto';

export const assignmentsRouter = Router();

// Helper to enrich assignment with members and checklist summary
function enrichAssignment(assignment: Assignment): Assignment {
  const members = db.assignmentMembers
    .filter(m => m.assignment_id === assignment.id)
    .map(m => {
      const profile = db.profiles.find(p => p.id === m.user_id);
      return {
        user_id: m.user_id,
        full_name: profile?.full_name || 'Unknown',
        email: profile?.email || '',
        role: m.role,
        assigned_at: m.assigned_at
      };
    });

  const checklistItems = db.shotChecklists.filter(c => c.assignment_id === assignment.id);
  const checklist_summary = {
    total: checklistItems.length,
    completed: checklistItems.filter(c => c.is_completed).length
  };

  const location = db.eventLocations.find(l => l.id === assignment.location_id);

  return {
    ...assignment,
    location_name: location?.name || assignment.location_name,
    assigned_members: members,
    checklist_summary
  };
}

// List all assignments with optional filters
assignmentsRouter.get('/', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { event_id, status, coverage_type, priority, my_assignments } = req.query;

  let list = [...db.assignments];

  if (event_id) {
    list = list.filter(a => a.event_id === event_id);
  }
  if (status) {
    list = list.filter(a => a.status === status);
  }
  if (coverage_type) {
    list = list.filter(a => a.coverage_type === coverage_type);
  }
  if (priority) {
    list = list.filter(a => a.priority === priority);
  }
  if (my_assignments === 'true' && req.user) {
    const myAssignmentIds = new Set(
      db.assignmentMembers.filter(m => m.user_id === req.user!.id).map(m => m.assignment_id)
    );
    list = list.filter(a => myAssignmentIds.has(a.id));
  }

  const enriched = list.map(enrichAssignment);

  res.json({
    success: true,
    data: enriched
  });
});

// Get single assignment with full details & checklists
assignmentsRouter.get('/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Assignment not found' }
    });
  }

  const enriched = enrichAssignment(assignment);
  const checklist = db.shotChecklists
    .filter(c => c.assignment_id === assignment.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  res.json({
    success: true,
    data: {
      ...enriched,
      checklist
    }
  });
});

// Create assignment
assignmentsRouter.post(
  '/',
  authMiddleware,
  requireRoles('MEDIA_COORDINATOR', 'SUPER_ADMIN', 'PRESIDENT'),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateAssignmentSchema.parse(req.body);

    const newAssignmentId = crypto.randomUUID();

    const location = parsed.location_id
      ? db.eventLocations.find(l => l.id === parsed.location_id)
      : undefined;

    const newAssignment: Assignment = {
      id: newAssignmentId,
      event_id: parsed.event_id,
      location_id: parsed.location_id,
      location_name: location?.name,
      title: parsed.title,
      coverage_type: parsed.coverage_type,
      priority: parsed.priority,
      status: 'ASSIGNED',
      day_session: parsed.day_session,
      start_time: parsed.start_time,
      deadline: parsed.deadline,
      expected_deliverable: parsed.expected_deliverable,
      drive_folder_url: parsed.drive_folder_url,
      notes: parsed.notes,
      created_by: req.user!.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.assignments.push(newAssignment);
    await SupabaseService.persistAssignment(newAssignment);

    // Add members
    if (parsed.assigned_user_ids && parsed.assigned_user_ids.length > 0) {
      for (const userId of parsed.assigned_user_ids) {
        const userProfile = db.profiles.find(p => p.id === userId);
        const assignedRole: UserRole = userProfile?.roles.includes('PHOTOGRAPHER')
          ? 'PHOTOGRAPHER'
          : userProfile?.roles.includes('VIDEOGRAPHER')
          ? 'VIDEOGRAPHER'
          : 'PHOTOGRAPHER';

        db.assignmentMembers.push({
          assignment_id: newAssignmentId,
          user_id: userId,
          role: assignedRole,
          assigned_at: new Date().toISOString()
        });

        // Notify assigned user
        NotificationService.send({
          userId,
          title: 'New Coverage Assignment',
          message: `You were assigned to "${newAssignment.title}" for ${newAssignment.day_session}.`,
          type: 'ASSIGNMENT',
          linkUrl: '/field-crew'
        });
      }
    }

    // Add checklist items
    if (parsed.checklist_items && parsed.checklist_items.length > 0) {
      for (let index = 0; index < parsed.checklist_items.length; index++) {
        const item = parsed.checklist_items[index];
        const checkItem = {
          id: crypto.randomUUID(),
          assignment_id: newAssignmentId,
          shot_title: item.shot_title,
          description: item.description,
          is_required: item.is_required,
          is_completed: false,
          sort_order: index + 1
        };
        db.shotChecklists.push(checkItem);
        await SupabaseService.persistChecklistItem(checkItem);
      }
    }

    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'CREATE_ASSIGNMENT',
      entityType: 'ASSIGNMENT',
      entityId: newAssignmentId,
      details: { title: newAssignment.title, priority: newAssignment.priority }
    });

    res.status(201).json({
      success: true,
      data: enrichAssignment(newAssignment)
    });
  }
);

// Controlled Status Transition
assignmentsRouter.patch('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Assignment not found' }
    });
  }

  const { status: targetStatus, notes } = UpdateAssignmentStatusSchema.parse(req.body);
  const currentStatus = assignment.status;

  // 1. Check if state transition is allowed
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  const isSuperAdminOrCoord = req.user!.roles.some(r => ['SUPER_ADMIN', 'MEDIA_COORDINATOR'].includes(r));

  if (!allowedTransitions.includes(targetStatus) && !isSuperAdminOrCoord) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TRANSITION',
        message: `Cannot transition status from ${currentStatus} to ${targetStatus}. Permitted next steps: [${allowedTransitions.join(', ')}]`
      }
    });
  }

  // 2. Check role authorization for this specific target status
  const permittedRoles = ROLE_TRANSITION_PERMISSIONS[targetStatus] || [];
  const hasRolePermission = req.user!.roles.some(r => permittedRoles.includes(r)) || req.user!.roles.includes('SUPER_ADMIN');

  if (!hasRolePermission) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN_TRANSITION',
        message: `Your current role(s) cannot transition an assignment to ${targetStatus}. Required roles: [${permittedRoles.join(', ')}]`
      }
    });
  }

  // 3. Apply transition
  assignment.status = targetStatus;
  assignment.updated_at = new Date().toISOString();
  await SupabaseService.persistAssignment(assignment);
  if (notes) {
    assignment.notes = (assignment.notes ? assignment.notes + '\n' : '') + `[${new Date().toLocaleTimeString()} by ${req.user!.full_name}]: ${notes}`;
  }

  // 4. Audit Log
  AuditService.log({
    actorId: req.user!.id,
    actorName: req.user!.full_name,
    actorRole: req.user!.roles[0],
    action: 'TRANSITION_STATUS',
    entityType: 'ASSIGNMENT',
    entityId: assignment.id,
    details: { from: currentStatus, to: targetStatus, notes }
  });

  // 5. Notify relevant members
  const memberUserIds = db.assignmentMembers
    .filter(m => m.assignment_id === assignment.id)
    .map(m => m.user_id);

  for (const uid of memberUserIds) {
    if (uid !== req.user!.id) {
      NotificationService.send({
        userId: uid,
        title: `Assignment Status Updated: ${targetStatus}`,
        message: `"${assignment.title}" moved from ${currentStatus} to ${targetStatus}.`,
        type: 'ASSIGNMENT',
        linkUrl: `/assignments/${assignment.id}`
      });
    }
  }

  res.json({
    success: true,
    data: enrichAssignment(assignment)
  });
});

// Toggle Shot Checklist item
assignmentsRouter.patch('/:id/checklist/:itemId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const item = db.shotChecklists.find(c => c.id === req.params.itemId && c.assignment_id === req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Checklist item not found' }
    });
  }

  item.is_completed = !item.is_completed;
  if (item.is_completed) {
    item.completed_by = req.user!.id;
    item.completed_by_name = req.user!.full_name;
    item.completed_at = new Date().toISOString();
  } else {
    item.completed_by = undefined;
    item.completed_by_name = undefined;
    item.completed_at = undefined;
  }

  await SupabaseService.persistChecklistItem(item);

  res.json({
    success: true,
    data: item
  });
});

// Add custom checklist item to an assignment
assignmentsRouter.post('/:id/checklist', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const assignment = db.assignments.find(a => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Assignment not found' }
    });
  }

  const { shot_title, description, is_required } = req.body;
  if (!shot_title || typeof shot_title !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'shot_title is required' }
    });
  }

  const existingCount = db.shotChecklists.filter(c => c.assignment_id === assignment.id).length;
  const newItem = {
    id: crypto.randomUUID(),
    assignment_id: assignment.id,
    shot_title: shot_title.trim(),
    description: description || undefined,
    is_required: Boolean(is_required),
    is_completed: false,
    sort_order: existingCount + 1
  };

  db.shotChecklists.push(newItem);
  await SupabaseService.persistChecklistItem(newItem);

  res.status(201).json({
    success: true,
    data: newItem
  });
});

// Delete assignment and all child checklists and memberships
assignmentsRouter.delete(
  '/:id',
  authMiddleware,
  requireRoles('MEDIA_COORDINATOR', 'SUPER_ADMIN', 'PRESIDENT'),
  async (req: AuthenticatedRequest, res: Response) => {
    const assignmentIndex = db.assignments.findIndex(a => a.id === req.params.id);
    if (assignmentIndex === -1) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Assignment not found' }
      });
    }

    const assignment = db.assignments[assignmentIndex];

    // Remove from in-memory arrays
    db.assignments.splice(assignmentIndex, 1);
    db.shotChecklists = db.shotChecklists.filter(c => c.assignment_id !== assignment.id);
    db.assignmentMembers = db.assignmentMembers.filter(m => m.assignment_id !== assignment.id);

    // Delete from Supabase Cloud
    await SupabaseService.deleteAssignment(assignment.id);

    // Audit log
    AuditService.log({
      actorId: req.user!.id,
      actorName: req.user!.full_name,
      actorRole: req.user!.roles[0],
      action: 'DELETE_ASSIGNMENT',
      entityType: 'ASSIGNMENT',
      entityId: assignment.id,
      details: { title: assignment.title }
    });

    res.json({
      success: true,
      message: `Assignment "${assignment.title}" deleted successfully`
    });
  }
);
