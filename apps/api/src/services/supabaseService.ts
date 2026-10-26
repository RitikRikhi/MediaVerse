import { supabase } from '../db/client';
import { db } from '../db/memoryStore';
import {
  Assignment,
  ShotChecklistItem,
  MediaAsset,
  MediaFolder,
  EditingProject,
  EditVersion,
  ReviewComment,
  Approval,
  InAppNotification,
  ActivityLog,
  UserProfile
} from '@mediaverse/shared-types';

export class SupabaseService {
  private static isAvailable(): boolean {
    return Boolean(supabase);
  }

  // Hydrate memoryStore with records from Supabase Cloud on startup
  static async hydrateFromSupabase(): Promise<void> {
    if (!this.isAvailable()) {
      console.log('[SupabaseService] Cloud database client not configured, using memory baseline');
      return;
    }

    try {
      console.log('[SupabaseService] Hydrating application state from Supabase Cloud PostgreSQL...');
      
      const [
        assignmentsRes,
        checklistsRes,
        mediaRes,
        projectsRes,
        versionsRes,
        commentsRes,
        approvalsRes,
        foldersRes,
        profilesRes,
        rolesRes
      ] = await Promise.all([
        supabase!.from('assignments').select('*'),
        supabase!.from('shot_checklists').select('*'),
        supabase!.from('media_assets').select('*'),
        supabase!.from('editing_projects').select('*'),
        supabase!.from('edit_versions').select('*'),
        supabase!.from('review_comments').select('*'),
        supabase!.from('approvals').select('*'),
        supabase!.from('media_folders').select('*'),
        supabase!.from('profiles').select('*'),
        supabase!.from('user_roles').select('*')
      ]);

      if (profilesRes.data && profilesRes.data.length > 0) {
        for (const p of profilesRes.data) {
          const userRoles = rolesRes.data
            ? rolesRes.data.filter((r: any) => r.user_id === p.id).map((r: any) => r.role)
            : [];
          const existing = db.profiles.find(e => e.id === p.id);
          const roles = userRoles.length > 0 ? userRoles : (existing?.roles || ['PHOTOGRAPHER']);

          const merged: UserProfile = {
            ...p,
            roles
          };
          const idx = db.profiles.findIndex(existing => existing.id === p.id);
          if (idx >= 0) db.profiles[idx] = merged;
          else db.profiles.push(merged);
        }
      }

      if (foldersRes.data && foldersRes.data.length > 0) {
        db.mediaFolders = foldersRes.data as any;
      }

      if (assignmentsRes.data && assignmentsRes.data.length > 0) {
        db.assignments = assignmentsRes.data as any;
      }
      if (checklistsRes.data && checklistsRes.data.length > 0) {
        db.shotChecklists = checklistsRes.data as any;
      }
      if (mediaRes.data && mediaRes.data.length > 0) {
        db.mediaAssets = mediaRes.data as any;
      }
      if (projectsRes.data && projectsRes.data.length > 0) {
        db.editingProjects = projectsRes.data as any;
      }
      if (versionsRes.data && versionsRes.data.length > 0) {
        db.editVersions = versionsRes.data as any;
      }
      if (commentsRes.data && commentsRes.data.length > 0) {
        db.reviewComments = commentsRes.data as any;
      }
      if (approvalsRes.data && approvalsRes.data.length > 0) {
        db.approvals = approvalsRes.data as any;
      }

      console.log(`[SupabaseService] Hydration complete: ${db.assignments.length} assignments, ${db.mediaAssets.length} media assets, ${db.profiles.length} profiles loaded from Cloud`);
    } catch (err: any) {
      console.warn('[SupabaseService] Cloud hydration warning:', err.message);
    }
  }

  // Persist Assignment
  static async persistAssignment(assignment: Partial<Assignment>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('assignments').upsert({
        id: assignment.id,
        event_id: assignment.event_id,
        location_id: assignment.location_id,
        title: assignment.title,
        coverage_type: assignment.coverage_type,
        priority: assignment.priority,
        status: assignment.status,
        day_session: assignment.day_session,
        start_time: assignment.start_time,
        deadline: assignment.deadline,
        expected_deliverable: assignment.expected_deliverable,
        drive_folder_id: assignment.drive_folder_id,
        drive_folder_url: assignment.drive_folder_url,
        notes: assignment.notes,
        created_by: assignment.created_by,
        updated_at: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist assignment:', err.message);
    }
  }

  // Persist Shot Checklist Item
  static async persistChecklistItem(item: Partial<ShotChecklistItem>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('shot_checklists').upsert({
        id: item.id,
        assignment_id: item.assignment_id,
        shot_title: item.shot_title,
        description: item.description,
        is_required: item.is_required,
        is_completed: item.is_completed,
        completed_by: item.completed_by,
        completed_at: item.completed_at,
        sort_order: item.sort_order || 0
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist checklist item:', err.message);
    }
  }

  // Persist Media Asset
  static async persistMediaAsset(asset: Partial<MediaAsset>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('media_assets').upsert({
        id: asset.id,
        event_id: asset.event_id,
        assignment_id: asset.assignment_id,
        uploader_id: asset.uploader_id,
        filename: asset.filename,
        media_type: asset.media_type,
        drive_file_id: asset.drive_file_id,
        drive_web_url: asset.drive_web_url,
        drive_thumbnail_url: asset.drive_thumbnail_url,
        file_size_bytes: asset.file_size_bytes,
        mime_type: asset.mime_type,
        description: asset.description,
        tags: asset.tags || [],
        is_verified: asset.is_verified ?? true,
        created_at: asset.created_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist media asset:', err.message);
    }
  }

  // Persist Media Folder
  static async persistMediaFolder(folder: Partial<MediaFolder>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('media_folders').upsert({
        id: folder.id,
        event_id: folder.event_id,
        folder_name: folder.folder_name,
        folder_path: folder.folder_path,
        drive_folder_id: folder.drive_folder_id,
        drive_web_url: folder.drive_web_url,
        is_system_created: folder.is_system_created ?? true,
        created_at: folder.created_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist media folder:', err.message);
    }
  }

  // Persist Editing Project
  static async persistEditingProject(project: Partial<EditingProject>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('editing_projects').upsert({
        id: project.id,
        assignment_id: project.assignment_id,
        event_id: project.event_id,
        title: project.title,
        brief: project.brief,
        aspect_ratio: project.aspect_ratio,
        deliverable_specs: project.deliverable_specs,
        assigned_editor_id: project.assigned_editor_id,
        status: project.status,
        priority: project.priority,
        deadline: project.deadline,
        created_at: project.created_at || new Date().toISOString(),
        updated_at: project.updated_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist editing project:', err.message);
    }
  }

  // Persist Edit Version
  static async persistEditVersion(version: Partial<EditVersion>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('edit_versions').upsert({
        id: version.id,
        editing_project_id: version.editing_project_id,
        version_number: version.version_number,
        version_label: version.version_label,
        drive_file_id: version.drive_file_id,
        drive_web_url: version.drive_web_url,
        preview_url: version.preview_url,
        notes: version.notes,
        submitted_by: version.submitted_by,
        submitted_at: version.submitted_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist edit version:', err.message);
    }
  }

  // Persist Review Comment
  static async persistReviewComment(comment: Partial<ReviewComment>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('review_comments').upsert({
        id: comment.id,
        edit_version_id: comment.edit_version_id,
        reviewer_id: comment.reviewer_id,
        timecode_seconds: comment.timecode_seconds,
        comment: comment.comment,
        is_resolved: comment.is_resolved ?? false,
        created_at: comment.created_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist review comment:', err.message);
    }
  }

  // Persist Approval
  static async persistApproval(approval: Partial<Approval>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('approvals').upsert({
        id: approval.id,
        editing_project_id: approval.editing_project_id,
        edit_version_id: approval.edit_version_id,
        reviewer_id: approval.reviewer_id,
        decision: approval.decision,
        feedback: approval.feedback,
        created_at: approval.created_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist approval:', err.message);
    }
  }

  // Persist Notification
  static async persistNotification(notif: Partial<InAppNotification>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('notifications').upsert({
        id: notif.id,
        user_id: notif.user_id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        link_url: notif.link_url,
        is_read: notif.is_read ?? false,
        created_at: notif.created_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist notification:', err.message);
    }
  }

  // Persist Profile
  static async persistProfile(profile: Partial<UserProfile>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('profiles').upsert({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
        is_active: profile.is_active ?? true,
        roles: profile.roles || ['PHOTOGRAPHER'],
        updated_at: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist profile:', err.message);
    }
  }

  // Persist Activity Log
  static async persistActivityLog(log: Partial<ActivityLog>): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await supabase!.from('activity_logs').upsert({
        id: log.id,
        actor_id: log.actor_id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        details: log.details || {},
        created_at: log.created_at || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[SupabaseService] Failed to persist activity log:', err.message);
    }
  }

  // Direct Cloud Query helpers for Verification & Extreme Testing
  static async queryCloudTable<T = any>(tableName: string, filter?: { column: string; value: any }): Promise<T[]> {
    if (!this.isAvailable()) return [];
    let query = supabase!.from(tableName).select('*');
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase query failed on ${tableName}: ${error.message}`);
    }
    return (data || []) as T[];
  }
}
