import {
  UserProfile,
  EventModel,
  EventLocation,
  Assignment,
  AssignmentMemberInfo,
  ShotChecklistItem,
  MediaAsset,
  MediaFolder,
  EditingProject,
  EditVersion,
  ReviewComment,
  Approval,
  InAppNotification,
  ActivityLog,
  AIActionLog,
  IntegrationSetting,
  UserRole,
  AssignmentStatus
} from '@mediaverse/shared-types';

export class MemoryStore {
  profiles: UserProfile[] = [];
  events: EventModel[] = [];
  eventLocations: EventLocation[] = [];
  assignments: Assignment[] = [];
  assignmentMembers: { assignment_id: string; user_id: string; role: UserRole; assigned_at: string }[] = [];
  shotChecklists: ShotChecklistItem[] = [];
  mediaAssets: MediaAsset[] = [];
  mediaFolders: MediaFolder[] = [];
  editingProjects: EditingProject[] = [];
  editVersions: EditVersion[] = [];
  reviewComments: ReviewComment[] = [];
  approvals: Approval[] = [];
  notifications: InAppNotification[] = [];
  activityLogs: ActivityLog[] = [];
  aiActionLogs: AIActionLog[] = [];
  integrationSettings: IntegrationSetting[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    // 1. Profiles & Roles
    this.profiles = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@dsa.cgc.edu.in',
        full_name: 'Prof. Rajesh Sharma',
        phone: '+91 9876543210',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        is_active: true,
        roles: ['SUPER_ADMIN'],
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
        updated_at: new Date('2026-09-01T10:00:00Z').toISOString()
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'president@dsa.cgc.edu.in',
        full_name: 'Aman Verma',
        phone: '+91 9876543211',
        avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
        is_active: true,
        roles: ['PRESIDENT'],
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
        updated_at: new Date('2026-09-01T10:00:00Z').toISOString()
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'coordinator@dsa.cgc.edu.in',
        full_name: 'Priya Patel',
        phone: '+91 9876543212',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        is_active: true,
        roles: ['MEDIA_COORDINATOR'],
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
        updated_at: new Date('2026-09-01T10:00:00Z').toISOString()
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'photographer@dsa.cgc.edu.in',
        full_name: 'Rohan Singh',
        phone: '+91 9876543213',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        is_active: true,
        roles: ['PHOTOGRAPHER'],
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
        updated_at: new Date('2026-09-01T10:00:00Z').toISOString()
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        email: 'videographer@dsa.cgc.edu.in',
        full_name: 'Vikram Malhotra',
        phone: '+91 9876543214',
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
        is_active: true,
        roles: ['VIDEOGRAPHER'],
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
        updated_at: new Date('2026-09-01T10:00:00Z').toISOString()
      },
      {
        id: '66666666-6666-6666-6666-666666666666',
        email: 'editor@dsa.cgc.edu.in',
        full_name: 'Simran Kaur',
        phone: '+91 9876543215',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        is_active: true,
        roles: ['VIDEO_EDITOR'],
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
        updated_at: new Date('2026-09-01T10:00:00Z').toISOString()
      },
      {
        id: '77777777-7777-7777-7777-777777777777',
        email: 'reviewer@dsa.cgc.edu.in',
        full_name: 'Dr. Neha Gupta',
        phone: '+91 9876543216',
        avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
        is_active: true,
        roles: ['REVIEWER'],
        created_at: new Date('2026-09-01T10:00:00Z').toISOString(),
        updated_at: new Date('2026-09-01T10:00:00Z').toISOString()
      }
    ];

    // 2. Events
    this.events = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'SAVISKAR 2026',
        slug: 'saviskar-2026',
        description: 'Annual National Techno-Cultural Mega Fest of CGC University featuring 40+ events, hackathons, star nights, and cultural showcases.',
        start_date: '2026-10-28T08:00:00Z',
        end_date: '2026-10-29T23:00:00Z',
        status: 'LIVE',
        drive_root_folder_id: 'drive-root-saviskar-2026',
        drive_root_folder_url: 'https://drive.google.com/drive/folders/saviskar-2026-root',
        created_by: '33333333-3333-3333-3333-333333333333',
        created_at: new Date('2026-09-15T12:00:00Z').toISOString(),
        updated_at: new Date('2026-09-15T12:00:00Z').toISOString()
      }
    ];

    // 3. Event Locations
    this.eventLocations = [
      {
        id: 'bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Main Auditorium (Block 3)',
        code: 'AUD-MAIN',
        description: 'Inauguration, Keynotes & Star Night stage',
        created_at: new Date().toISOString()
      },
      {
        id: 'bbbbbbbb-2222-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Open Air Theatre (OAT)',
        code: 'OAT-CULT',
        description: 'Battle of the Bands, Fashion Show, Group Dance',
        created_at: new Date().toISOString()
      },
      {
        id: 'bbbbbbbb-3333-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Tech Arena & Robotics Arena',
        code: 'TECH-ARENA',
        description: 'Hackathon presentations and Bot Fights',
        created_at: new Date().toISOString()
      },
      {
        id: 'bbbbbbbb-4444-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Campus Quad & Food Plaza',
        code: 'CAMPUS-QUAD',
        description: 'Crowd reactions, sponsor booths, candid moments',
        created_at: new Date().toISOString()
      }
    ];

    // 4. Assignments
    this.assignments = [
      {
        id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        location_id: 'bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa',
        location_name: 'Main Auditorium (Block 3)',
        title: 'SAVISKAR 2026 Grand Inauguration & Lamp Lighting',
        coverage_type: 'PHOTOGRAPHY',
        priority: 'CRITICAL',
        status: 'UPLOAD_PENDING',
        day_session: 'Day 1 - Morning',
        start_time: '2026-10-28T09:00:00Z',
        deadline: '2026-10-28T12:00:00Z',
        expected_deliverable: '30 curated high-resolution edited photos (Guests, Dignitaries, Lamp lighting)',
        drive_folder_id: 'folder-inaug-photo',
        drive_folder_url: 'https://drive.google.com/drive/folders/saviskar-photo-inaug',
        notes: 'Focus on Chief Guest Dr. APJ memorial lecture speaker and Chancellor reactions.',
        created_by: '33333333-3333-3333-3333-333333333333',
        created_at: new Date('2026-10-20T10:00:00Z').toISOString(),
        updated_at: new Date('2026-10-28T09:30:00Z').toISOString()
      },
      {
        id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        location_id: 'bbbbbbbb-2222-aaaa-aaaa-aaaaaaaaaaaa',
        location_name: 'Open Air Theatre (OAT)',
        title: 'Battle of the Bands & Rock Concert Multi-Cam Coverage',
        coverage_type: 'VIDEOGRAPHY',
        priority: 'HIGH',
        status: 'AVAILABLE_FOR_EDITING',
        day_session: 'Day 1 - Evening',
        start_time: '2026-10-28T17:00:00Z',
        deadline: '2026-10-28T21:00:00Z',
        expected_deliverable: 'Raw 4K 60fps clips + separate zoom audio WAV stems from soundboard',
        drive_folder_id: 'folder-rock-vid',
        drive_folder_url: 'https://drive.google.com/drive/folders/saviskar-vid-rockband',
        notes: 'Capture stage wide, drummer close-up, lead solo, crowd headbanging, moshpit energy.',
        created_by: '33333333-3333-3333-3333-333333333333',
        created_at: new Date('2026-10-20T10:00:00Z').toISOString(),
        updated_at: new Date('2026-10-28T21:30:00Z').toISOString()
      },
      {
        id: 'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        location_id: 'bbbbbbbb-3333-aaaa-aaaa-aaaaaaaaaaaa',
        location_name: 'Tech Arena & Robotics Arena',
        title: 'Robo-Wars Championship & Hackathon 24hr Sprint',
        coverage_type: 'HYBRID',
        priority: 'MEDIUM',
        status: 'CAPTURING',
        day_session: 'Day 2 - Morning',
        start_time: '2026-10-29T10:00:00Z',
        deadline: '2026-10-29T14:00:00Z',
        expected_deliverable: 'B-roll reels of robot impacts + portraits of top 3 finalist teams',
        drive_folder_id: 'folder-tech-arena',
        drive_folder_url: 'https://drive.google.com/drive/folders/saviskar-tech-arena',
        notes: 'Slow-motion 120fps recommended for arena spark collisions.',
        created_by: '33333333-3333-3333-3333-333333333333',
        created_at: new Date('2026-10-20T10:00:00Z').toISOString(),
        updated_at: new Date('2026-10-29T10:15:00Z').toISOString()
      },
      {
        id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        location_id: 'bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa',
        location_name: 'Main Auditorium (Block 3)',
        title: 'Celebrity Star Night Concert (EDM & Bollywood Fusion)',
        coverage_type: 'VIDEOGRAPHY',
        priority: 'CRITICAL',
        status: 'ASSIGNED',
        day_session: 'Day 2 - Night',
        start_time: '2026-10-29T19:30:00Z',
        deadline: '2026-10-29T23:30:00Z',
        expected_deliverable: 'Full concert highlights reel (9:16 Instagram Reel + 16:9 YouTube Recap)',
        drive_folder_id: 'folder-star-night',
        drive_folder_url: 'https://drive.google.com/drive/folders/saviskar-star-night',
        notes: 'Gimbal operators on pit stage right and left. Drone pilot authorized for stadium aerials.',
        created_by: '33333333-3333-3333-3333-333333333333',
        created_at: new Date('2026-10-20T10:00:00Z').toISOString(),
        updated_at: new Date('2026-10-20T10:00:00Z').toISOString()
      }
    ];

    // 5. Assignment Members
    this.assignmentMembers = [
      { assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa', user_id: '44444444-4444-4444-4444-444444444444', role: 'PHOTOGRAPHER', assigned_at: new Date().toISOString() },
      { assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa', user_id: '55555555-5555-5555-5555-555555555555', role: 'VIDEOGRAPHER', assigned_at: new Date().toISOString() },
      { assignment_id: 'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa', user_id: '44444444-4444-4444-4444-444444444444', role: 'PHOTOGRAPHER', assigned_at: new Date().toISOString() },
      { assignment_id: 'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa', user_id: '55555555-5555-5555-5555-555555555555', role: 'VIDEOGRAPHER', assigned_at: new Date().toISOString() },
      { assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa', user_id: '55555555-5555-5555-5555-555555555555', role: 'VIDEOGRAPHER', assigned_at: new Date().toISOString() }
    ];

    // 6. Shot Checklists (Fresh, uncompleted items ready for crew checkoff)
    this.shotChecklists = [
      {
        id: 'dddddddd-1111-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: 'Chief Guest Arrival at Porch',
        description: 'Arrival car greeting with Director & Chancellor',
        is_required: true,
        is_completed: false,
        sort_order: 1
      },
      {
        id: 'dddddddd-2222-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: 'Lamp Lighting by Dignitaries',
        description: 'Wide stage view + tight focus on flame & flowers',
        is_required: true,
        is_completed: false,
        sort_order: 2
      },
      {
        id: 'dddddddd-3333-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: 'Audience Standing Ovation & Clapping',
        description: 'Balcony angle looking down across full house',
        is_required: true,
        is_completed: false,
        sort_order: 3
      },
      {
        id: 'dddddddd-4444-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: 'Drum Solo 120fps Slow-Mo with Cymbals Smoke',
        description: 'Capture crash cymbal vibration with backlight',
        is_required: true,
        is_completed: false,
        sort_order: 1
      },
      {
        id: 'dddddddd-5555-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: 'Lead Guitarist Jump Off Riser',
        description: 'Low angle 24mm f/1.8 freeze frame moment',
        is_required: true,
        is_completed: false,
        sort_order: 2
      },
      {
        id: 'dddddddd-6666-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: 'Crowd Flashlights & Sing-Along Horizon',
        description: 'Ultra wide gimbal pan across 3000 students',
        is_required: false,
        is_completed: false,
        sort_order: 3
      }
    ];

    // 7. Media Assets (Fresh & clean for real SAVISKAR 2026 uploads)
    this.mediaAssets = [];

    // 8. Editing Projects (Official SAVISKAR 2026 Festival Editing Pipeline)
    this.editingProjects = [
      {
        id: 'eeeeeeee-1111-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'SAVISKAR 2026 Day 1 Teaser Reel (9:16)',
        brief: 'Fast-paced vertical reel capturing lamp lighting, VIP addresses, crowd reactions, and flash mob highlights with sync-to-beat audio.',
        aspect_ratio: '9:16',
        deliverable_specs: '1080x1920 MP4, H.264, 60fps, -14 LUFS',
        assigned_editor_id: '66666666-6666-6666-6666-666666666666',
        status: 'ASSIGNED',
        priority: 'HIGH',
        deadline: '2026-10-28T18:00:00Z',
        created_at: new Date('2026-10-28T10:00:00Z').toISOString(),
        updated_at: new Date('2026-10-28T10:00:00Z').toISOString()
      }
    ];

    // 9. Edit Versions (Fresh & clean)
    this.editVersions = [];

    // 10. Review Comments (Fresh & clean)
    this.reviewComments = [];

    // 11. Approvals (Fresh & clean)
    this.approvals = [];

    // 12. Notifications
    this.notifications = [
      {
        id: '3333ffff-0000-aaaa-aaaa-aaaaaaaaaaaa',
        user_id: '33333333-3333-3333-3333-333333333333',
        title: 'SAVISKAR 2026 Production Hub Ready',
        message: 'System initialized and ready for live coverage. Review your assignments and shotlists.',
        type: 'SYSTEM',
        link_url: '/field-crew',
        is_read: false,
        created_at: new Date().toISOString()
      }
    ];

    // 13. Activity Logs
    this.activityLogs = [
      {
        id: '4444ffff-0000-aaaa-aaaa-aaaaaaaaaaaa',
        actor_id: '11111111-1111-1111-1111-111111111111',
        actor_name: 'Prof. Rajesh Sharma',
        actor_role: 'SUPER_ADMIN',
        action: 'SYSTEM_INITIALIZED',
        entity_type: 'SYSTEM',
        entity_id: 'saviskar-2026-prod',
        details: { message: 'All production systems clean and operational for SAVISKAR 2026.' },
        created_at: new Date().toISOString()
      }
    ];

    // 13. Integration Settings
    this.integrationSettings = [
      {
        id: '5555ffff-1111-aaaa-aaaa-aaaaaaaaaaaa',
        provider: 'GOOGLE_DRIVE',
        config_key: 'ROOT_FOLDER',
        config_value_masked: 'drive-root-saviskar-2026',
        is_configured: true,
        is_active: true,
        updated_at: new Date().toISOString()
      },
      {
        id: '5555ffff-2222-aaaa-aaaa-aaaaaaaaaaaa',
        provider: 'GEMINI',
        config_key: 'MODEL',
        config_value_masked: 'gemini-1.5-flash',
        is_configured: false,
        is_active: false,
        updated_at: new Date().toISOString()
      }
    ];
  }
}

export const db = new MemoryStore();
