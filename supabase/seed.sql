-- ============================================================================
-- DSA MediaVerse AI - Seed Data for SAVISKAR 2026 (Oct 28-29, 2026)
-- CGC University Media Crew
-- ============================================================================

-- 1. PROFILES (Deterministic UUIDs for seamless testing)
INSERT INTO profiles (id, email, full_name, phone, avatar_url, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@dsa.cgc.edu.in', 'Prof. Rajesh Sharma', '+91 9876543210', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', true),
  ('22222222-2222-2222-2222-222222222222', 'president@dsa.cgc.edu.in', 'Aman Verma', '+91 9876543211', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', true),
  ('33333333-3333-3333-3333-333333333333', 'coordinator@dsa.cgc.edu.in', 'Priya Patel', '+91 9876543212', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', true),
  ('44444444-4444-4444-4444-444444444444', 'photographer@dsa.cgc.edu.in', 'Rohan Singh', '+91 9876543213', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', true),
  ('55555555-5555-5555-5555-555555555555', 'videographer@dsa.cgc.edu.in', 'Vikram Malhotra', '+91 9876543214', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', true),
  ('66666666-6666-6666-6666-666666666666', 'editor@dsa.cgc.edu.in', 'Simran Kaur', '+91 9876543215', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', true),
  ('77777777-7777-7777-7777-777777777777', 'reviewer@dsa.cgc.edu.in', 'Dr. Neha Gupta', '+91 9876543216', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', true)
ON CONFLICT (id) DO NOTHING;

-- 2. USER ROLES
INSERT INTO user_roles (user_id, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'SUPER_ADMIN'),
  ('22222222-2222-2222-2222-222222222222', 'PRESIDENT'),
  ('33333333-3333-3333-3333-333333333333', 'MEDIA_COORDINATOR'),
  ('44444444-4444-4444-4444-444444444444', 'PHOTOGRAPHER'),
  ('55555555-5555-5555-5555-555555555555', 'VIDEOGRAPHER'),
  ('66666666-6666-6666-6666-666666666666', 'VIDEO_EDITOR'),
  ('77777777-7777-7777-7777-777777777777', 'REVIEWER')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. EVENT: SAVISKAR 2026
INSERT INTO events (id, name, slug, description, start_date, end_date, status, drive_root_folder_id, drive_root_folder_url, created_by)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'SAVISKAR 2026',
  'saviskar-2026',
  'Annual National Techno-Cultural Mega Fest of CGC University featuring 40+ events, hackathons, star nights, and cultural showcases.',
  '2026-10-28T08:00:00Z',
  '2026-10-29T23:00:00Z',
  'LIVE',
  'drive-root-saviskar-2026',
  'https://drive.google.com/drive/folders/saviskar-2026-root',
  '33333333-3333-3333-3333-333333333333'
)
ON CONFLICT (id) DO NOTHING;

-- 4. EVENT LOCATIONS
INSERT INTO event_locations (id, event_id, name, code, description)
VALUES
  ('bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Main Auditorium (Block 3)', 'AUD-MAIN', 'Inauguration, Keynotes & Star Night stage'),
  ('bbbbbbbb-2222-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Open Air Theatre (OAT)', 'OAT-CULT', 'Battle of the Bands, Fashion Show, Group Dance'),
  ('bbbbbbbb-3333-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tech Arena & Robotics Arena', 'TECH-ARENA', 'Hackathon presentations and Bot Fights'),
  ('bbbbbbbb-4444-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Campus Quad & Food Plaza', 'CAMPUS-QUAD', 'Crowd reactions, sponsor booths, candid moments')
ON CONFLICT (id) DO NOTHING;

-- 5. ASSIGNMENTS
INSERT INTO assignments (
  id, event_id, location_id, title, coverage_type, priority, status,
  day_session, start_time, deadline, expected_deliverable,
  drive_folder_id, drive_folder_url, notes, created_by
)
VALUES
  (
    'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa',
    'SAVISKAR 2026 Grand Inauguration & Lamp Lighting',
    'PHOTOGRAPHY',
    'CRITICAL',
    'UPLOAD_PENDING',
    'Day 1 - Morning',
    '2026-10-28T09:00:00Z',
    '2026-10-28T12:00:00Z',
    '30 curated high-resolution edited photos (Guests, Dignitaries, Lamp lighting)',
    'folder-inaug-photo',
    'https://drive.google.com/drive/folders/saviskar-photo-inaug',
    'Focus on Chief Guest Dr. APJ memorial lecture speaker and Chancellor reactions.',
    '33333333-3333-3333-3333-333333333333'
  ),
  (
    'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-2222-aaaa-aaaa-aaaaaaaaaaaa',
    'Battle of the Bands & Rock Concert Multi-Cam Coverage',
    'VIDEOGRAPHY',
    'HIGH',
    'AVAILABLE_FOR_EDITING',
    'Day 1 - Evening',
    '2026-10-28T17:00:00Z',
    '2026-10-28T21:00:00Z',
    'Raw 4K 60fps clips + separate zoom audio WAV stems from soundboard',
    'folder-rock-vid',
    'https://drive.google.com/drive/folders/saviskar-vid-rockband',
    'Capture stage wide, drummer close-up, lead solo, crowd headbanging, moshpit energy.',
    '33333333-3333-3333-3333-333333333333'
  ),
  (
    'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-3333-aaaa-aaaa-aaaaaaaaaaaa',
    'Robo-Wars Championship & Hackathon 24hr Sprint',
    'HYBRID',
    'MEDIUM',
    'CAPTURING',
    'Day 2 - Morning',
    '2026-10-29T10:00:00Z',
    '2026-10-29T14:00:00Z',
    'B-roll reels of robot impacts + portraits of top 3 finalist teams',
    'folder-tech-arena',
    'https://drive.google.com/drive/folders/saviskar-tech-arena',
    'Slow-motion 120fps recommended for arena spark collisions.',
    '33333333-3333-3333-3333-333333333333'
  ),
  (
    'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa',
    'Celebrity Star Night Concert (EDM & Bollywood Fusion)',
    'VIDEOGRAPHY',
    'CRITICAL',
    'ASSIGNED',
    'Day 2 - Night',
    '2026-10-29T19:30:00Z',
    '2026-10-29T23:30:00Z',
    'Full concert highlights reel (9:16 Instagram Reel + 16:9 YouTube Recap)',
    'folder-star-night',
    'https://drive.google.com/drive/folders/saviskar-star-night',
    'Gimbal operators on pit stage right and left. Drone pilot authorized for stadium aerials.',
    '33333333-3333-3333-3333-333333333333'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. ASSIGNMENT MEMBERS
INSERT INTO assignment_members (assignment_id, user_id, role)
VALUES
  ('cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'PHOTOGRAPHER'),
  ('cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'VIDEOGRAPHER'),
  ('cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'PHOTOGRAPHER'),
  ('cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'VIDEOGRAPHER'),
  ('cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'VIDEOGRAPHER')
ON CONFLICT (assignment_id, user_id) DO NOTHING;

-- 7. SHOT CHECKLISTS
INSERT INTO shot_checklists (id, assignment_id, shot_title, description, is_required, is_completed, completed_by, completed_at, sort_order)
VALUES
  ('dddddddd-1111-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa', 'Chief Guest Arrival at Porch', 'Arrival car greeting with Director & Chancellor', true, true, '44444444-4444-4444-4444-444444444444', '2026-10-28T09:15:00Z', 1),
  ('dddddddd-2222-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa', 'Lamp Lighting by Dignitaries', 'Wide stage view + tight focus on flame & flowers', true, true, '44444444-4444-4444-4444-444444444444', '2026-10-28T09:40:00Z', 2),
  ('dddddddd-3333-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa', 'Audience Standing Ovation & Clapping', 'Balcony angle looking down across full house', true, false, null, null, 3),
  ('dddddddd-4444-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa', 'Drum Solo 120fps Slow-Mo with Cymbals Smoke', 'Capture crash cymbal vibration with backlight', true, true, '55555555-5555-5555-5555-555555555555', '2026-10-28T18:30:00Z', 1),
  ('dddddddd-5555-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa', 'Lead Guitarist Jump Off Riser', 'Low angle 24mm f/1.8 freeze frame moment', true, true, '55555555-5555-5555-5555-555555555555', '2026-10-28T19:10:00Z', 2),
  ('dddddddd-6666-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa', 'Crowd Flashlights & Sing-Along Horizon', 'Ultra wide gimbal pan across 3000 students', false, true, '55555555-5555-5555-5555-555555555555', '2026-10-28T20:00:00Z', 3)
ON CONFLICT (id) DO NOTHING;

-- 8. MEDIA ASSETS
INSERT INTO media_assets (
  id, event_id, assignment_id, uploader_id, filename, media_type,
  drive_file_id, drive_web_url, drive_thumbnail_url, file_size_bytes, mime_type,
  capture_time, description, tags, is_verified
)
VALUES
  (
    'eeeeeeee-1111-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
    '44444444-4444-4444-4444-444444444444',
    'SAV_INAUG_DSC_0481.ARW',
    'RAW_PHOTO',
    'drive-file-photo-001',
    'https://drive.google.com/file/d/drive-file-photo-001/view',
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=300',
    42800000,
    'image/x-sony-arw',
    '2026-10-28T09:42:00Z',
    'Lamp lighting ceremony with all 5 dignitaries in sharp focus',
    ARRAY['inauguration', 'lamp-lighting', 'dignitaries', 'auditorium'],
    true
  ),
  (
    'eeeeeeee-2222-aaaa-aaaa-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
    '55555555-5555-5555-5555-555555555555',
    'SAV_ROCK_CAM_A_0012.MP4',
    'RAW_VIDEO',
    'drive-file-vid-002',
    'https://drive.google.com/file/d/drive-file-vid-002/view',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300',
    3420000000,
    'video/mp4',
    '2026-10-28T18:45:00Z',
    'Band finale solo with CO2 cannons and stage lasers in 4K 60fps',
    ARRAY['concert', 'rock-band', '4k', 'stage-lighting'],
    true
  )
ON CONFLICT (id) DO NOTHING;

-- 9. EDITING PROJECTS
INSERT INTO editing_projects (
  id, assignment_id, event_id, title, brief, aspect_ratio, deliverable_specs,
  assigned_editor_id, priority, status, deadline
)
VALUES (
  'ffffffff-1111-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'SAVISKAR Day 1 Highlights Reel for Instagram & YouTube Shorts',
  'Fast-paced 45-second high energy reel syncing rock band guitar riffs and inauguration confetti drop. Include CGC University logo outro and SAVISKAR title badge.',
  '9:16',
  '1080x1920 60fps MP4 H.264, Audio normalized to -14 LUFS, max length 45s.',
  '66666666-6666-6666-6666-666666666666',
  'CRITICAL',
  'IN_REVIEW',
  '2026-10-29T02:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

-- 10. EDIT VERSIONS
INSERT INTO edit_versions (
  id, editing_project_id, version_number, version_label, drive_file_id,
  drive_web_url, preview_url, notes, submitted_by
)
VALUES
  (
    '1111ffff-1111-aaaa-aaaa-aaaaaaaaaaaa',
    'ffffffff-1111-aaaa-aaaa-aaaaaaaaaaaa',
    1,
    'v1 Rough Cut',
    'drive-edit-v1',
    'https://drive.google.com/file/d/drive-edit-v1/view',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'Initial rhythmic cut on band drop. Color grade is neutral REC709.',
    '66666666-6666-6666-6666-666666666666'
  ),
  (
    '1111ffff-2222-aaaa-aaaa-aaaaaaaaaaaa',
    'ffffffff-1111-aaaa-aaaa-aaaaaaaaaaaa',
    2,
    'v2 Polished Cut with Audio Mix',
    'drive-edit-v2',
    'https://drive.google.com/file/d/drive-edit-v2/view',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'Color graded with warm orange/teal tones, bass drop enhanced, added SAVISKAR logo lower-third.',
    '66666666-6666-6666-6666-666666666666'
  )
ON CONFLICT (id) DO NOTHING;

-- 11. REVIEW COMMENTS
INSERT INTO review_comments (id, edit_version_id, reviewer_id, timecode_seconds, comment, is_resolved)
VALUES
  ('2222ffff-1111-aaaa-aaaa-aaaaaaaaaaaa', '1111ffff-2222-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 12.4, 'The transition into the crowd cut is slightly abrupt. Add a brief whip-pan sound effect.', false),
  ('2222ffff-2222-aaaa-aaaa-aaaaaaaaaaaa', '1111ffff-2222-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 38.0, 'Chancellor logo looks crisp here. Excellent color balance on the drum solo.', true)
ON CONFLICT (id) DO NOTHING;

-- 12. NOTIFICATIONS
INSERT INTO notifications (id, user_id, title, message, type, link_url, is_read)
VALUES
  ('3333ffff-1111-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'New Edit Version Feedback', 'Dr. Neha Gupta added comments to SAVISKAR Day 1 Highlights Reel v2.', 'REVIEW', '/editor', false),
  ('3333ffff-2222-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Coverage Upload Pending', 'Grand Inauguration coverage completed. Please register Drive folder link.', 'UPLOAD', '/field-crew', false)
ON CONFLICT (id) DO NOTHING;

-- 13. ACTIVITY LOGS
INSERT INTO activity_logs (id, actor_id, action, entity_type, entity_id, details)
VALUES
  ('4444ffff-1111-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'CREATE_EVENT', 'EVENT', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"name": "SAVISKAR 2026", "coordinator": "Priya Patel"}'::jsonb),
  ('4444ffff-2222-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'SUBMIT_EDIT_VERSION', 'EDIT_VERSION', '1111ffff-2222-aaaa-aaaa-aaaaaaaaaaaa', '{"version": 2, "label": "v2 Polished Cut with Audio Mix"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
