import { z } from 'zod';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const USER_ROLES = [
  'SUPER_ADMIN',
  'PRESIDENT',
  'MEDIA_COORDINATOR',
  'PHOTOGRAPHER',
  'VIDEOGRAPHER',
  'VIDEO_EDITOR',
  'REVIEWER'
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const COVERAGE_TYPES = ['PHOTOGRAPHY', 'VIDEOGRAPHY', 'HYBRID'] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

export const ASSIGNMENT_STATUSES = [
  'ASSIGNED',
  'CAPTURING',
  'UPLOAD_PENDING',
  'AVAILABLE_FOR_EDITING',
  'EDITING',
  'IN_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
  'DELIVERED'
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const PRIORITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const MEDIA_TYPES = [
  'RAW_PHOTO',
  'RAW_VIDEO',
  'EDITED_DRAFT',
  'FINAL_VIDEO',
  'AUDIO_STEM',
  'GRAPHIC_ASSET',
  'OTHER'
] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REVISION_REQUESTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// Workflow Valid Status Transitions Map
export const VALID_STATUS_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  ASSIGNED: ['CAPTURING'],
  CAPTURING: ['UPLOAD_PENDING'],
  UPLOAD_PENDING: ['AVAILABLE_FOR_EDITING', 'IN_REVIEW', 'APPROVED'], // Direct approval allowed for pure photo tasks
  AVAILABLE_FOR_EDITING: ['EDITING'],
  EDITING: ['IN_REVIEW'],
  IN_REVIEW: ['REVISION_REQUIRED', 'APPROVED'],
  REVISION_REQUIRED: ['EDITING', 'CAPTURING'],
  APPROVED: ['DELIVERED'],
  DELIVERED: [] // Terminal state unless coordinator reopens
};

// Which roles can trigger which transitions
export const ROLE_TRANSITION_PERMISSIONS: Record<AssignmentStatus, UserRole[]> = {
  ASSIGNED: ['MEDIA_COORDINATOR', 'SUPER_ADMIN'],
  CAPTURING: ['PHOTOGRAPHER', 'VIDEOGRAPHER', 'MEDIA_COORDINATOR', 'SUPER_ADMIN'],
  UPLOAD_PENDING: ['PHOTOGRAPHER', 'VIDEOGRAPHER', 'MEDIA_COORDINATOR', 'SUPER_ADMIN'],
  AVAILABLE_FOR_EDITING: ['MEDIA_COORDINATOR', 'SUPER_ADMIN', 'PHOTOGRAPHER', 'VIDEOGRAPHER'],
  EDITING: ['VIDEO_EDITOR', 'MEDIA_COORDINATOR', 'SUPER_ADMIN'],
  IN_REVIEW: ['VIDEO_EDITOR', 'MEDIA_COORDINATOR', 'SUPER_ADMIN', 'PHOTOGRAPHER'],
  REVISION_REQUIRED: ['REVIEWER', 'MEDIA_COORDINATOR', 'SUPER_ADMIN'],
  APPROVED: ['REVIEWER', 'MEDIA_COORDINATOR', 'SUPER_ADMIN', 'PRESIDENT'],
  DELIVERED: ['MEDIA_COORDINATOR', 'SUPER_ADMIN', 'REVIEWER', 'PRESIDENT']
};

// ============================================================================
// MODELS / ENTITIES
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  roles: UserRole[];
  created_at: string;
  updated_at: string;
}

export interface EventModel {
  id: string;
  name: string;
  slug: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'DRAFT' | 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'ARCHIVED';
  drive_root_folder_id?: string;
  drive_root_folder_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EventLocation {
  id: string;
  event_id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
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
  day_session: string; // e.g., "Day 1 - Morning", "Day 2 - Valedictory"
  start_time: string;
  deadline: string;
  expected_deliverable: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Computed / Joined fields
  assigned_members?: AssignmentMemberInfo[];
  checklist_summary?: { total: number; completed: number };
}

export interface AssignmentMemberInfo {
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  assigned_at: string;
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

export interface MediaFolder {
  id: string;
  event_id: string;
  assignment_id?: string;
  folder_name: string;
  folder_path: string;
  drive_folder_id: string;
  drive_web_url: string;
  is_system_created: boolean;
  created_at: string;
  user_id?: string;
  user_name?: string;
  parent_folder_id?: string;
  role?: UserRole;
  is_personal?: boolean;
}

export interface FolderNode {
  id?: string;
  name: string;
  path: string;
  children?: FolderNode[];
  driveFolderId?: string;
  driveWebUrl?: string;
}

export interface PersonalSubfolder {
  id: string;
  name: string;
  path: string;
  driveFolderId: string;
  driveWebUrl: string;
  isDefault: boolean;
  created_at: string;
}

export interface PersonalDriveInfo {
  userId: string;
  userName: string;
  role: UserRole;
  structureMode?: 'ROLE_SPECIFIC' | 'FULL_EVENT';
  customEmail?: string;
  sharedWithEmail?: string;
  personalRootFolderId: string;
  personalRootFolderUrl: string;
  personalRootPath: string;
  tree?: FolderNode;
  subfolders: PersonalSubfolder[];
}

export interface EditingProject {
  id: string;
  assignment_id: string;
  assignment_title?: string;
  event_id: string;
  title: string;
  brief: string;
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5' | 'OTHER';
  deliverable_specs: string; // e.g. "1080x1920 MP4, H.264, 30s max, CGC watermark"
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
  version_label: string; // e.g. "v1 Rough Cut", "v2 Color Graded", "Final 4K"
  drive_file_id?: string;
  drive_web_url: string;
  preview_url?: string;
  notes: string;
  submitted_by: string;
  submitted_by_name?: string;
  submitted_at: string;
  created_at?: string;
  comments?: ReviewComment[];
  approvals?: Approval[];
}

export interface ReviewComment {
  id: string;
  edit_version_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  author_name?: string;
  timecode_seconds?: number; // e.g. 14.5s
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
  decision: ReviewStatus;
  feedback: string;
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'ASSIGNMENT' | 'UPLOAD' | 'EDIT' | 'REVIEW' | 'APPROVAL' | 'SYSTEM' | 'DEADLINE';
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string;
  actor_name?: string;
  actor_role?: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface AIActionLog {
  id: string;
  user_id: string;
  action_name: string;
  input_prompt: string;
  tool_invoked?: string;
  tool_arguments?: Record<string, any>;
  execution_status: 'SUCCESS' | 'ERROR' | 'FALLBACK';
  duration_ms: number;
  created_at: string;
}

export interface IntegrationSetting {
  id: string;
  provider: 'GOOGLE_DRIVE' | 'GEMINI';
  config_key: string;
  config_value_masked: string;
  is_configured: boolean;
  is_active: boolean;
  updated_by?: string;
  updated_at: string;
}

// ============================================================================
// DASHBOARD & SUMMARY METRICS
// ============================================================================

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

// ============================================================================
// ZOD SCHEMAS FOR INPUT VALIDATION
// ============================================================================

export const CreateEventSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).default(''),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  drive_root_folder_id: z.string().optional(),
  drive_root_folder_url: z.string().url().optional()
});

export const CreateAssignmentSchema = z.object({
  event_id: z.string().uuid(),
  location_id: z.string().uuid().optional(),
  title: z.string().min(3).max(120),
  coverage_type: z.enum(COVERAGE_TYPES),
  priority: z.enum(PRIORITY_LEVELS).default('MEDIUM'),
  day_session: z.string().min(2).max(60),
  start_time: z.string().datetime(),
  deadline: z.string().datetime(),
  expected_deliverable: z.string().min(3).max(255),
  drive_folder_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  assigned_user_ids: z.array(z.string().uuid()).default([]),
  checklist_items: z
    .array(
      z.object({
        shot_title: z.string().min(2).max(200),
        description: z.string().max(500).optional(),
        is_required: z.boolean().default(true)
      })
    )
    .optional()
});

export const UpdateAssignmentStatusSchema = z.object({
  status: z.enum(ASSIGNMENT_STATUSES),
  notes: z.string().max(1000).optional()
});

export const RegisterMediaAssetSchema = z.object({
  event_id: z.string().uuid(),
  assignment_id: z.string().uuid().optional(),
  filename: z.string().min(2).max(255),
  media_type: z.enum(MEDIA_TYPES),
  drive_web_url: z.string().url('Must be a valid URL'),
  drive_file_id: z.string().optional(),
  file_size_bytes: z.number().nonnegative().optional(),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(30)).default([])
});

export const SubmitEditVersionSchema = z.object({
  editing_project_id: z.string().uuid(),
  version_label: z.string().min(1).max(50),
  drive_web_url: z.string().url('Must be a valid Drive URL'),
  preview_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(2000).default('')
});

export const ReviewDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REVISION_REQUESTED']),
  feedback: z.string().min(3).max(2000),
  timecode_seconds: z.number().optional()
});

export const AddReviewCommentSchema = z.object({
  edit_version_id: z.string().uuid(),
  comment: z.string().min(2).max(2000),
  timecode_seconds: z.number().nonnegative().optional()
});

export const AI_CONTEXT_TYPES = [
  'GENERAL',
  'SHOTLIST',
  'EDITING_BRIEF',
  'SOCIAL_CAPTION',
  'STATUS_SUMMARY',
  'EQUIPMENT_CHECK',
  'CRISIS_RESOLVE',
  'ASSET_TAGGER'
] as const;

export type AIContextType = (typeof AI_CONTEXT_TYPES)[number];

export const AIPromptRequestSchema = z.object({
  prompt: z.string().min(2).max(4000),
  context_type: z.enum(AI_CONTEXT_TYPES),
  assignment_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional()
});
