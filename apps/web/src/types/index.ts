export type UserRole =
  | 'SUPER_ADMIN'
  | 'PRESIDENT'
  | 'MEDIA_COORDINATOR'
  | 'PHOTOGRAPHER'
  | 'VIDEOGRAPHER'
  | 'VIDEO_EDITOR'
  | 'REVIEWER';

export type AssignmentStatus =
  | 'ASSIGNED'
  | 'CAPTURING'
  | 'UPLOAD_PENDING'
  | 'AVAILABLE_FOR_EDITING'
  | 'EDITING'
  | 'IN_REVIEW'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'DELIVERED';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CoverageType = 'PHOTOGRAPHY' | 'VIDEOGRAPHY' | 'HYBRID';
export type MediaType =
  | 'RAW_PHOTO'
  | 'RAW_VIDEO'
  | 'EDITED_DRAFT'
  | 'FINAL_VIDEO'
  | 'AUDIO_STEM'
  | 'GRAPHIC_ASSET'
  | 'OTHER';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  roles: UserRole[];
}

export interface Assignment {
  id: string;
  event_id: string;
  location_id?: string;
  location_name?: string;
  title: string;
  coverage_type: CoverageType;
  priority: PriorityLevel;
  status: AssignmentStatus;
  day_session: string;
  start_time: string;
  deadline: string;
  expected_deliverable: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  assigned_members?: {
    user_id: string;
    full_name: string;
    email: string;
    role: UserRole;
    assigned_at: string;
  }[];
  checklist_summary?: {
    total: number;
    completed: number;
  };
}

export interface ShotChecklistItem {
  id: string;
  assignment_id: string;
  shot_title: string;
  description?: string;
  is_required: boolean;
  is_completed: boolean;
  completed_by?: string;
  completed_by_name?: string;
  completed_at?: string;
  sort_order: number;
}

export interface MediaAsset {
  id: string;
  event_id: string;
  assignment_id?: string;
  assignment_title?: string;
  uploader_id: string;
  uploader_name?: string;
  filename: string;
  media_type: MediaType;
  drive_file_id?: string;
  drive_web_url: string;
  drive_thumbnail_url?: string;
  file_size_bytes?: number;
  mime_type?: string;
  capture_time?: string;
  description?: string;
  tags: string[];
  is_verified: boolean;
  created_at: string;
}

export interface EditingProject {
  id: string;
  assignment_id: string;
  assignment_title?: string;
  event_id: string;
  title: string;
  brief: string;
  aspect_ratio: string;
  deliverable_specs: string;
  assigned_editor_id?: string;
  assigned_editor_name?: string;
  priority: PriorityLevel;
  status: AssignmentStatus;
  deadline: string;
  created_at: string;
  updated_at: string;
  versions?: EditVersion[];
}

export interface EditVersion {
  id: string;
  editing_project_id: string;
  version_number: number;
  version_label: string;
  drive_file_id?: string;
  drive_web_url: string;
  preview_url?: string;
  notes: string;
  submitted_by: string;
  submitted_by_name?: string;
  submitted_at: string;
  comments?: ReviewComment[];
  approvals?: Approval[];
}

export interface ReviewComment {
  id: string;
  edit_version_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  timecode_seconds?: number;
  comment: string;
  is_resolved: boolean;
  created_at: string;
}

export interface Approval {
  id: string;
  editing_project_id: string;
  edit_version_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  decision: 'APPROVED' | 'REVISION_REQUESTED';
  feedback: string;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface CoordinatorMetrics {
  total_assignments: number;
  assigned: number;
  capturing: number;
  upload_pending: number;
  available_for_editing: number;
  editing: number;
  in_review: number;
  revision_required: number;
  approved: number;
  delivered: number;
  overdue: number;
  total_registered_assets: number;
  total_active_crew: number;
}
