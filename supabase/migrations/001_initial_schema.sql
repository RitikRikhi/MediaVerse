-- ============================================================================
-- DSA MediaVerse AI - Supabase PostgreSQL Initial Migration
-- Target Event: SAVISKAR 2026 (October 28–29, 2026), CGC University
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role_type AS ENUM (
    'SUPER_ADMIN',
    'PRESIDENT',
    'MEDIA_COORDINATOR',
    'PHOTOGRAPHER',
    'VIDEOGRAPHER',
    'VIDEO_EDITOR',
    'REVIEWER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE coverage_type AS ENUM (
    'PHOTOGRAPHY',
    'VIDEOGRAPHY',
    'HYBRID'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM (
    'ASSIGNED',
    'CAPTURING',
    'UPLOAD_PENDING',
    'AVAILABLE_FOR_EDITING',
    'EDITING',
    'IN_REVIEW',
    'REVISION_REQUIRED',
    'APPROVED',
    'DELIVERED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE priority_level AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM (
    'RAW_PHOTO',
    'RAW_VIDEO',
    'EDITED_DRAFT',
    'FINAL_VIDEO',
    'AUDIO_STEM',
    'GRAPHIC_ASSET',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE review_decision AS ENUM (
    'PENDING',
    'APPROVED',
    'REVISION_REQUESTED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 1. PROFILES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. USER_ROLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role_type NOT NULL,
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_role_unique UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ----------------------------------------------------------------------------
-- 3. EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('DRAFT', 'UPCOMING', 'LIVE', 'COMPLETED', 'ARCHIVED')),
  drive_root_folder_id TEXT,
  drive_root_folder_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. EVENT_LOCATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_location_code_unique UNIQUE(event_id, code)
);
CREATE INDEX IF NOT EXISTS idx_event_locations_event ON event_locations(event_id);

-- ----------------------------------------------------------------------------
-- 5. ASSIGNMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  location_id UUID REFERENCES event_locations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  coverage_type coverage_type NOT NULL DEFAULT 'PHOTOGRAPHY',
  priority priority_level NOT NULL DEFAULT 'MEDIUM',
  status assignment_status NOT NULL DEFAULT 'ASSIGNED',
  day_session TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  expected_deliverable TEXT NOT NULL,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assignments_event ON assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_deadline ON assignments(deadline);

-- ----------------------------------------------------------------------------
-- 6. ASSIGNMENT_MEMBERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assignment_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role_type NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assignment_member_unique UNIQUE(assignment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_assignment_members_assignment ON assignment_members(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_members_user ON assignment_members(user_id);

-- ----------------------------------------------------------------------------
-- 7. SHOT_CHECKLISTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shot_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  shot_title TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shot_checklists_assignment ON shot_checklists(assignment_id);

-- ----------------------------------------------------------------------------
-- 8. MEDIA_ASSETS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  uploader_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  media_type media_type NOT NULL,
  drive_file_id TEXT,
  drive_web_url TEXT NOT NULL,
  drive_thumbnail_url TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  capture_time TIMESTAMPTZ,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_assets_event ON media_assets(event_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_assignment ON media_assets(assignment_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_uploader ON media_assets(uploader_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_drive_file_id ON media_assets(drive_file_id);

-- ----------------------------------------------------------------------------
-- 9. MEDIA_FOLDERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,
  folder_name TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  drive_folder_id TEXT NOT NULL,
  drive_web_url TEXT NOT NULL,
  is_system_created BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_folders_event ON media_folders(event_id);

-- ----------------------------------------------------------------------------
-- 10. EDITING_PROJECTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS editing_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9',
  deliverable_specs TEXT NOT NULL,
  assigned_editor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  priority priority_level NOT NULL DEFAULT 'MEDIUM',
  status assignment_status NOT NULL DEFAULT 'AVAILABLE_FOR_EDITING',
  deadline TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_editing_projects_editor ON editing_projects(assigned_editor_id);
CREATE INDEX IF NOT EXISTS idx_editing_projects_assignment ON editing_projects(assignment_id);

-- ----------------------------------------------------------------------------
-- 11. EDIT_VERSIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edit_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  editing_project_id UUID NOT NULL REFERENCES editing_projects(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  version_label TEXT NOT NULL,
  drive_file_id TEXT,
  drive_web_url TEXT NOT NULL,
  preview_url TEXT,
  notes TEXT DEFAULT '',
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edit_versions_project_number_unique UNIQUE(editing_project_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_edit_versions_project ON edit_versions(editing_project_id);

-- ----------------------------------------------------------------------------
-- 12. REVIEW_COMMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edit_version_id UUID NOT NULL REFERENCES edit_versions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  timecode_seconds NUMERIC(8,2),
  comment TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_comments_version ON review_comments(edit_version_id);

-- ----------------------------------------------------------------------------
-- 13. APPROVALS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  editing_project_id UUID NOT NULL REFERENCES editing_projects(id) ON DELETE CASCADE,
  edit_version_id UUID NOT NULL REFERENCES edit_versions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision review_decision NOT NULL,
  feedback TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approvals_project ON approvals(editing_project_id);

-- ----------------------------------------------------------------------------
-- 14. NOTIFICATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ----------------------------------------------------------------------------
-- 15. ACTIVITY_LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 16. AI_ACTION_LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_action_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_name TEXT NOT NULL,
  input_prompt TEXT NOT NULL,
  tool_invoked TEXT,
  tool_arguments JSONB,
  execution_status TEXT NOT NULL,
  duration_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_user ON ai_action_logs(user_id);

-- ----------------------------------------------------------------------------
-- 17. INTEGRATION_SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS integration_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL CHECK (provider IN ('GOOGLE_DRIVE', 'GEMINI')),
  config_key TEXT NOT NULL,
  config_value_masked TEXT NOT NULL,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT integration_setting_unique UNIQUE(provider, config_key)
);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shot_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE editing_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

-- Base reading policies for authenticated users
CREATE POLICY "Profiles readable by authenticated users" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "User roles readable by authenticated users" ON user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Events readable by authenticated users" ON events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Locations readable by authenticated users" ON event_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Assignments readable by authenticated users" ON assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Assignment members readable by authenticated users" ON assignment_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Shot checklists readable by authenticated users" ON shot_checklists
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Media assets readable by authenticated users" ON media_assets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editing projects readable by authenticated users" ON editing_projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Edit versions readable by authenticated users" ON edit_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Review comments readable by authenticated users" ON review_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Approvals readable by authenticated users" ON approvals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Notifications readable by owner" ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Activity logs readable by coordinators and leadership" ON activity_logs
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('SUPER_ADMIN', 'PRESIDENT', 'MEDIA_COORDINATOR')
    )
  );

CREATE POLICY "Integration settings readable by admin and coordinator" ON integration_settings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('SUPER_ADMIN', 'MEDIA_COORDINATOR')
    )
  );
