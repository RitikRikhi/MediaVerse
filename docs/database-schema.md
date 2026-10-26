# DSA MediaVerse AI — Database Schema Specification

Target Event: **SAVISKAR 2026** (October 28–29, 2026), CGC University  
Target Database: **PostgreSQL 15+** (Supabase Free-Tier Compatible)

---

## Controlled Enums

```sql
user_role_type:
  'SUPER_ADMIN', 'PRESIDENT', 'MEDIA_COORDINATOR',
  'PHOTOGRAPHER', 'VIDEOGRAPHER', 'VIDEO_EDITOR', 'REVIEWER'

coverage_type:
  'PHOTOGRAPHY', 'VIDEOGRAPHY', 'HYBRID'

assignment_status:
  'ASSIGNED', 'CAPTURING', 'UPLOAD_PENDING',
  'AVAILABLE_FOR_EDITING', 'EDITING', 'IN_REVIEW',
  'REVISION_REQUIRED', 'APPROVED', 'DELIVERED'

priority_level:
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'

media_type:
  'RAW_PHOTO', 'RAW_VIDEO', 'EDITED_DRAFT',
  'FINAL_VIDEO', 'AUDIO_STEM', 'GRAPHIC_ASSET', 'OTHER'

review_decision:
  'PENDING', 'APPROVED', 'REVISION_REQUESTED'
```

---

## 17 Tables Structure

### 1. `profiles`
User accounts and crew identity.
- `id` (UUID, PK)
- `email` (TEXT, UNIQUE, NOT NULL)
- `full_name` (TEXT, NOT NULL)
- `phone` (TEXT)
- `avatar_url` (TEXT)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 2. `user_roles`
Role-based access mapping.
- `id` (UUID, PK)
- `user_id` (UUID, FK profiles.id ON DELETE CASCADE)
- `role` (user_role_type, NOT NULL)
- `granted_by` (UUID, FK profiles.id)
- `created_at` (TIMESTAMPTZ)
- *UNIQUE(user_id, role)*

### 3. `events`
Event metadata.
- `id` (UUID, PK)
- `name` (TEXT, NOT NULL)
- `slug` (TEXT, UNIQUE, NOT NULL)
- `description` (TEXT)
- `start_date`, `end_date` (TIMESTAMPTZ, NOT NULL)
- `status` (TEXT, DEFAULT 'UPCOMING')
- `drive_root_folder_id`, `drive_root_folder_url` (TEXT)
- `created_by` (UUID, FK profiles.id)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 4. `event_locations`
Venues and stages.
- `id` (UUID, PK)
- `event_id` (UUID, FK events.id ON DELETE CASCADE)
- `name` (TEXT, NOT NULL)
- `code` (TEXT, NOT NULL)
- `description` (TEXT)
- *UNIQUE(event_id, code)*

### 5. `assignments`
Operational assignments.
- `id` (UUID, PK)
- `event_id` (UUID, FK events.id ON DELETE CASCADE)
- `location_id` (UUID, FK event_locations.id)
- `title` (TEXT, NOT NULL)
- `coverage_type` (coverage_type, NOT NULL)
- `priority` (priority_level, DEFAULT 'MEDIUM')
- `status` (assignment_status, DEFAULT 'ASSIGNED')
- `day_session` (TEXT, NOT NULL)
- `start_time`, `deadline` (TIMESTAMPTZ, NOT NULL)
- `expected_deliverable` (TEXT, NOT NULL)
- `drive_folder_id`, `drive_folder_url` (TEXT)
- `notes` (TEXT)
- `created_by` (UUID, FK profiles.id)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 6. `assignment_members`
Assigned crew members.
- `id` (UUID, PK)
- `assignment_id` (UUID, FK assignments.id ON DELETE CASCADE)
- `user_id` (UUID, FK profiles.id ON DELETE CASCADE)
- `role` (user_role_type, NOT NULL)
- `assigned_at` (TIMESTAMPTZ)
- *UNIQUE(assignment_id, user_id)*

### 7. `shot_checklists`
Specific required frames and angles.
- `id` (UUID, PK)
- `assignment_id` (UUID, FK assignments.id ON DELETE CASCADE)
- `shot_title` (TEXT, NOT NULL)
- `description` (TEXT)
- `is_required` (BOOLEAN, DEFAULT true)
- `is_completed` (BOOLEAN, DEFAULT false)
- `completed_by` (UUID, FK profiles.id)
- `completed_at` (TIMESTAMPTZ)
- `sort_order` (INT, DEFAULT 0)

### 8. `media_assets`
Registered Google Drive files.
- `id` (UUID, PK)
- `event_id` (UUID, FK events.id ON DELETE CASCADE)
- `assignment_id` (UUID, FK assignments.id)
- `uploader_id` (UUID, FK profiles.id ON DELETE CASCADE)
- `filename` (TEXT, NOT NULL)
- `media_type` (media_type, NOT NULL)
- `drive_file_id`, `drive_web_url`, `drive_thumbnail_url` (TEXT)
- `file_size_bytes` (BIGINT)
- `mime_type` (TEXT)
- `capture_time` (TIMESTAMPTZ)
- `description` (TEXT)
- `tags` (TEXT[])
- `is_verified` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ)

### 9. `media_folders`
Provisioned folder structures.
- `id` (UUID, PK)
- `event_id` (UUID, FK events.id ON DELETE CASCADE)
- `assignment_id` (UUID, FK assignments.id)
- `folder_name`, `folder_path`, `drive_folder_id`, `drive_web_url` (TEXT)
- `is_system_created` (BOOLEAN, DEFAULT true)
- `created_at` (TIMESTAMPTZ)

### 10. `editing_projects`
Video post-production project records.
- `id` (UUID, PK)
- `assignment_id` (UUID, FK assignments.id ON DELETE CASCADE)
- `event_id` (UUID, FK events.id ON DELETE CASCADE)
- `title`, `brief`, `aspect_ratio`, `deliverable_specs` (TEXT, NOT NULL)
- `assigned_editor_id` (UUID, FK profiles.id)
- `priority` (priority_level, DEFAULT 'MEDIUM')
- `status` (assignment_status, DEFAULT 'AVAILABLE_FOR_EDITING')
- `deadline` (TIMESTAMPTZ, NOT NULL)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### 11. `edit_versions`
Submitted cuts (`v1`, `v2`, `vFinal`).
- `id` (UUID, PK)
- `editing_project_id` (UUID, FK editing_projects.id ON DELETE CASCADE)
- `version_number` (INT, NOT NULL)
- `version_label` (TEXT, NOT NULL)
- `drive_file_id`, `drive_web_url`, `preview_url` (TEXT)
- `notes` (TEXT)
- `submitted_by` (UUID, FK profiles.id ON DELETE CASCADE)
- `submitted_at` (TIMESTAMPTZ)
- *UNIQUE(editing_project_id, version_number)*

### 12. `review_comments`
Timecoded feedback notes.
- `id` (UUID, PK)
- `edit_version_id` (UUID, FK edit_versions.id ON DELETE CASCADE)
- `reviewer_id` (UUID, FK profiles.id ON DELETE CASCADE)
- `timecode_seconds` (NUMERIC(8,2))
- `comment` (TEXT, NOT NULL)
- `is_resolved` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ)

### 13. `approvals`
Quality control decisions.
- `id` (UUID, PK)
- `editing_project_id` (UUID, FK editing_projects.id ON DELETE CASCADE)
- `edit_version_id` (UUID, FK edit_versions.id ON DELETE CASCADE)
- `reviewer_id` (UUID, FK profiles.id ON DELETE CASCADE)
- `decision` (review_decision, NOT NULL)
- `feedback` (TEXT, NOT NULL)
- `created_at` (TIMESTAMPTZ)

### 14. `notifications`
In-app notification records.
- `id` (UUID, PK)
- `user_id` (UUID, FK profiles.id ON DELETE CASCADE)
- `title`, `message`, `type`, `link_url` (TEXT)
- `is_read` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ)

### 15. `activity_logs`
Audit history.
- `id` (UUID, PK)
- `actor_id` (UUID, FK profiles.id)
- `action`, `entity_type` (TEXT, NOT NULL)
- `entity_id` (UUID)
- `details` (JSONB)
- `created_at` (TIMESTAMPTZ)

### 16. `ai_action_logs`
AI Assistant interactions.
- `id` (UUID, PK)
- `user_id` (UUID, FK profiles.id)
- `action_name`, `input_prompt` (TEXT, NOT NULL)
- `tool_invoked` (TEXT)
- `tool_arguments` (JSONB)
- `execution_status` (TEXT, NOT NULL)
- `duration_ms` (INT, DEFAULT 0)
- `created_at` (TIMESTAMPTZ)

### 17. `integration_settings`
Google Drive & Gemini configurations.
- `id` (UUID, PK)
- `provider` (TEXT, CHECK provider IN ('GOOGLE_DRIVE', 'GEMINI'))
- `config_key`, `config_value_masked` (TEXT, NOT NULL)
- `is_configured`, `is_active` (BOOLEAN)
- `updated_by` (UUID, FK profiles.id)
- `updated_at` (TIMESTAMPTZ)
