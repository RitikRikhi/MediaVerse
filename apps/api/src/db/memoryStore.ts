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
        status: 'ASSIGNED',
        day_session: 'Day 1 - Morning',
        start_time: '2026-10-28T09:00:00Z',
        deadline: '2026-10-28T13:00:00Z',
        expected_deliverable: '35 curated high-res edited photos (VIP arrivals, lamp lighting, presidential keynote, standing ovation) + RAW backup',
        drive_folder_id: 'folder-inaug-photo',
        drive_folder_url: 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
        notes: `🎯 CREATIVE DIRECTIVES:
• Capture formal arrival of Chief Guest and Chancellor at Block 3 porch with bouquet handover.
• Stage Lamp Lighting: Continuous burst (10fps) to catch the exact moment flames ignite with dignitaries looking at flame.
• Audience: Balcony wide-angle view capturing full house standing ovation during the national anthem.

⚙️ CAMERA & GEAR SPECS:
• Primary Body: 24-70mm f/2.8 (Main stage wide & mid).
• Secondary Body: 70-200mm f/2.8 (Tight expressions, dignitaries on dias).
• Shutter Speed: 1/250s minimum to freeze moving hands/dignitaries.
• ISO: Cap at 3200 (auditorium spotlights are bright on center stage).
• Color Profile: Standard Neutral RAW, White Balance 4800K.

⏰ TIMELINE & CALL TIMES:
• Call Time: 08:15 AM sharp at Media Center (Block 3, Room 102).
• Equipment & SD Check: 08:30 AM.
• Chief Guest Arrival: 09:15 AM.
• Ingestion Deadline: 13:00 PM (Hand off SD Card to Simran Kaur for Day 1 Teaser Cut).`,
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
        status: 'ASSIGNED',
        day_session: 'Day 1 - Evening',
        start_time: '2026-10-28T17:30:00Z',
        deadline: '2026-10-28T22:30:00Z',
        expected_deliverable: 'Raw 4K 60fps multi-cam footage (Cam A Pit, Cam B Gimbal, Cam C FOH Wide) + Zoom H6 WAV soundboard audio stems',
        drive_folder_id: 'folder-rock-vid',
        drive_folder_url: 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
        notes: `🎯 CREATIVE DIRECTIVES:
• Cam A (Stage Right): Low-angle 24mm f/1.8 heroic angles of lead singer & guitarist jumping off monitors.
• Cam B (Stage Left / Pit): 3-axis Gimbal operator tracking bassist and drummer close-up rhythm.
• Cam C (Center FOH): Ultra-wide 16-35mm capturing stage pyrotechnics, laser lighting, and crowd moshpit.

⚙️ CAMERA & GEAR SPECS:
• Resolution: 4K (3840x2160) at 60fps (allows 50% slow-motion ramping).
• Shutter Angle: 180° (1/120s shutter speed).
• Picture Profile: S-Log3 / C-Log / V-Log for stage dynamic range highlights.
• Audio: Line-level stereo feed from FOH mixer direct to Zoom H6 (-12dB safety track).

⏰ TIMELINE & CALL TIMES:
• Call Time: 16:45 PM at OAT Sound Console.
• Soundcheck & Multi-Cam Sync: 17:15 PM.
• First Band On Stage: 17:45 PM.
• Ingestion Deadline: 22:30 PM (Footage handed over to Video Editors).`,
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
        status: 'ASSIGNED',
        day_session: 'Day 2 - Morning',
        start_time: '2026-10-29T10:00:00Z',
        deadline: '2026-10-29T14:30:00Z',
        expected_deliverable: '25 High-impact action photos (arena sparks) + 12 Slow-mo B-roll clips for Day 2 recap reel',
        drive_folder_id: 'folder-tech-arena',
        drive_folder_url: 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
        notes: `🎯 CREATIVE DIRECTIVES:
• Robo-Wars Arena: Shoot through polycarbonate safety shield. Capture weapon spins, metal flips, and electric spark showers.
• Hackathon 24hr Sprint: Candid captures of teams debugging code, whiteboard diagrams, coffee cup stacks, and intense screen focus.
• Awards: Winner team standing behind their fighting robot with trophy.

⚙️ CAMERA & GEAR SPECS:
• Lenses: 85mm f/1.4 (for intimate coder focus falloff) & 24-70mm f/2.8.
• Frame Rate: 120fps slow-motion for robot collisions and flips.
• Shutter Speed: 1/500s minimum for arena metal sparks.

⏰ TIMELINE & CALL TIMES:
• Call Time: 09:30 AM at Tech Arena Control Desk.
• Hackathon Final Pitch: 10:30 AM.
• Robo-Wars Semis & Finals: 11:30 AM - 13:30 PM.
• Ingestion Deadline: 14:30 PM.`,
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
        coverage_type: 'HYBRID',
        priority: 'CRITICAL',
        status: 'ASSIGNED',
        day_session: 'Day 2 - Night',
        start_time: '2026-10-29T19:30:00Z',
        deadline: '2026-10-30T00:30:00Z',
        expected_deliverable: 'Master 4K Stage Cut + 3 Instant 9:16 Vertical Reel Hooks within 90 minutes + 40 Live Photos',
        drive_folder_id: 'folder-star-night',
        drive_folder_url: 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
        notes: `🎯 CREATIVE DIRECTIVES:
• Main Artist Entrance: Capture sudden blackout, smoke geysers, laser sweeps, and artist silhouette walking out.
• Stage Energy: 1 pit operator running gimbal along stage lip for low-angle wide hero shots.
• Audience Immersion: 1 roaming operator in center crowd capturing dancing, chanting, and emotional expressions.
• Aerials: Certified drone operator covering 5000+ stadium crowd overview during headliner tracks.

⚙️ CAMERA & GEAR SPECS:
• Video: 4K 60fps 10-bit; Shutter 1/120s; Low-light f/1.8 - f/2.8 glass.
• Photo: High ISO (3200-6400) with noise reduction calibrated; fast continuous tracking autofocus (Eye-AF).
• Storage: Minimum 256GB V90 SD cards per camera.

⏰ TIMELINE & CALL TIMES:
• Call Time: 18:30 PM at Security Briefing & Stage Pit Badge Distribution.
• Drone Airspace Clearance: 19:00 PM.
• Celebrity Stage Entry: 20:00 PM.
• Immediate Reel Handover: 22:00 PM (Mid-concert hook reel to Social Media team).
• Full Wrap & Ingest: 00:30 AM.`,
        created_by: '33333333-3333-3333-3333-333333333333',
        created_at: new Date('2026-10-20T10:00:00Z').toISOString(),
        updated_at: new Date('2026-10-20T10:00:00Z').toISOString()
      },
      {
        id: 'cccccccc-5555-aaaa-aaaa-aaaaaaaaaaaa',
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        location_id: 'bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa',
        location_name: 'Main Auditorium (Block 3)',
        title: 'SAVISKAR 2026 Grand Valedictory, Award Ceremony & Trophy Lift',
        coverage_type: 'PHOTOGRAPHY',
        priority: 'HIGH',
        status: 'ASSIGNED',
        day_session: 'Day 2 - Afternoon',
        start_time: '2026-10-29T15:00:00Z',
        deadline: '2026-10-29T19:30:00Z',
        expected_deliverable: '40 crisp stage award photos (every winning college delegation with shields) + Grand Overall Championship Trophy Lift',
        drive_folder_id: 'folder-valedictory',
        drive_folder_url: 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO',
        notes: `🎯 CREATIVE DIRECTIVES:
• Stage Presentations: Every single winning team must be framed with Vice Chancellor, Director, and Guest of Honor holding the certificate and trophy.
• Focus: Ensure all winning team faces are sharp and visible (shoot at f/4 to f/5.6 for group depth of field).
• Grand Finale: The Overall Championship Trophy presentation with golden confetti poppers — shoot continuous high-speed burst.

⚙️ CAMERA & GEAR SPECS:
• Lenses: 24-70mm f/2.8 (primary for group podiums), 70-200mm f/2.8 (for tight emotional reactions).
• Lighting: On-camera speedlight with MagMod diffuser or ceiling bounce for balanced shadow fill on stage.
• Aperture: f/4 minimum on team photos so back row is sharp.

⏰ TIMELINE & CALL TIMES:
• Call Time: 14:15 PM at Main Auditorium Stage.
• Award Presentation Begins: 15:30 PM.
• Overall Trophy Lift: 17:45 PM.
• Full Photo Drop Deadline: 19:30 PM.`,
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
      { assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa', user_id: '55555555-5555-5555-5555-555555555555', role: 'VIDEOGRAPHER', assigned_at: new Date().toISOString() },
      { assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa', user_id: '44444444-4444-4444-4444-444444444444', role: 'PHOTOGRAPHER', assigned_at: new Date().toISOString() },
      { assignment_id: 'cccccccc-5555-aaaa-aaaa-aaaaaaaaaaaa', user_id: '44444444-4444-4444-4444-444444444444', role: 'PHOTOGRAPHER', assigned_at: new Date().toISOString() }
    ];

    // 6. Shot Checklists (Fresh, rich, categorized items ready for crew checkoff)
    this.shotChecklists = [
      // Inauguration
      {
        id: 'dddddddd-1111-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Chief Guest & Chancellor Porch Arrival & Floral Greeting',
        description: 'VIP car arrival greeting with Director, Chancellor, and ceremonial floral welcome',
        is_required: true,
        is_completed: false,
        sort_order: 1
      },
      {
        id: 'dddddddd-2222-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Dignitaries Lighting Ceremonial Lamp (Close-up flame & faces)',
        description: 'Wide stage framing plus tight 70-200mm shot on flame ignition and dignitaries smiling',
        is_required: true,
        is_completed: false,
        sort_order: 2
      },
      {
        id: 'dddddddd-3333-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Keynote Speaker Address & Dias Dignitaries Panel',
        description: 'Presidential speech with SAVISKAR 2026 digital backdrop visible behind speaker',
        is_required: true,
        is_completed: false,
        sort_order: 3
      },
      {
        id: 'dddddddd-1112-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[CROWD] Full Balcony High-Angle View of Packed Auditorium',
        description: 'Balcony angle looking down across full house standing ovation',
        is_required: true,
        is_completed: false,
        sort_order: 4
      },
      {
        id: 'dddddddd-1113-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-1111-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[SOCIAL 9:16] Vertical Slow-Mo of Guest Procession into Auditorium',
        description: 'Smooth gimbal tracking shot for Instagram Reel opener',
        is_required: false,
        is_completed: false,
        sort_order: 5
      },

      // Rock Concert
      {
        id: 'dddddddd-4444-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Drum Solo 60fps/120fps Slow-Mo with Cymbal Smoke',
        description: 'Capture crash cymbal vibration with stage backlight & haze',
        is_required: true,
        is_completed: false,
        sort_order: 1
      },
      {
        id: 'dddddddd-5555-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Lead Guitarist Solo Jump Off Stage Riser',
        description: 'Low angle 24mm f/1.8 freeze frame moment with stage laser fan',
        is_required: true,
        is_completed: false,
        sort_order: 2
      },
      {
        id: 'dddddddd-6666-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[CROWD] Sea of 3000 Mobile Flashlights Sing-Along Wide Pan',
        description: 'Ultra wide gimbal pan across 3000 students holding phone flashlights',
        is_required: true,
        is_completed: false,
        sort_order: 3
      },
      {
        id: 'dddddddd-2223-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Confetti Explosion During Headliner Band Finale',
        description: 'Front pit angle capturing confetti blizzard over band and front rows',
        is_required: true,
        is_completed: false,
        sort_order: 4
      },
      {
        id: 'dddddddd-2224-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-2222-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[SOCIAL 9:16] Vertical Whip-Pan Transition from Crowd to Singer',
        description: 'Dynamic 9:16 vertical transition hook for quick reel turnaround',
        is_required: false,
        is_completed: false,
        sort_order: 5
      },

      // Robo-Wars & Hackathon
      {
        id: 'dddddddd-7777-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Bot-on-Bot High Speed Collision with Metal Sparks Flying',
        description: '120fps high-speed capture through arena polycarbonate safety shield',
        is_required: true,
        is_completed: false,
        sort_order: 1
      },
      {
        id: 'dddddddd-8888-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Flipped Robot Smoke & Final Countdown Buzzer',
        description: 'Referee countdown gesture and victorious team controller fist pump',
        is_required: true,
        is_completed: false,
        sort_order: 2
      },
      {
        id: 'dddddddd-9999-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[CANDID] Exhausted Coders Cheering at Successful 24hr Code Demo',
        description: 'Hackathon team high-five with live code on projector screen in background',
        is_required: true,
        is_completed: false,
        sort_order: 3
      },
      {
        id: 'dddddddd-3334-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-3333-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Winner Team Holding Trophy Behind Battle Bot in Arena',
        description: 'Podium portrait with team, robot, and medal',
        is_required: true,
        is_completed: false,
        sort_order: 4
      },

      // Star Night
      {
        id: 'dddddddd-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Celebrity Artist Grand Walk-On Through Smoke & Laser Geysers',
        description: 'Dramatic silhouette backlit entrance with massive crowd roar',
        is_required: true,
        is_completed: false,
        sort_order: 1
      },
      {
        id: 'dddddddd-bbbb-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Artist Singing Center Stage with Mic & Spotlight Rim Light',
        description: 'Tight 70-200mm shot capturing artist vocal intensity and emotion',
        is_required: true,
        is_completed: false,
        sort_order: 2
      },
      {
        id: 'dddddddd-cccc-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[CROWD] Massive 5000+ Crowd Jumping in Unison with Stadium Lasers',
        description: 'Wide pit angle showing stadium scale, stage lights, and waving hands',
        is_required: true,
        is_completed: false,
        sort_order: 3
      },
      {
        id: 'dddddddd-dddd-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Grand Fireworks & CO2 Blast Finale Across Full Stadium',
        description: 'Ultra-wide angle capture of overhead sky fireworks above main stage',
        is_required: true,
        is_completed: false,
        sort_order: 4
      },
      {
        id: 'dddddddd-eeee-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[SOCIAL 9:16] Viral Beat-Drop Transition Hook (Crowd to Artist Close-up)',
        description: 'Pre-cut vertical 9:16 hook ready for immediate Instagram upload',
        is_required: true,
        is_completed: false,
        sort_order: 5
      },

      // Valedictory
      {
        id: 'dddddddd-ffff-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-5555-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Overall University Champion College Trophy Lift with Golden Confetti',
        description: 'Overall trophy lift moment with team captains hoisting trophy in air with confetti blizzard',
        is_required: true,
        is_completed: false,
        sort_order: 1
      },
      {
        id: 'dddddddd-1010-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-5555-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Academic & Cultural Dean Handing Over First-Place Gold Shields',
        description: 'Official stage handover photos for each competitive category',
        is_required: true,
        is_completed: false,
        sort_order: 2
      },
      {
        id: 'dddddddd-2020-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-5555-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[CANDID] Winning Students Embracing and Celebrating in Aisle',
        description: 'Emotional hugs, college flags waving, and tears of joy',
        is_required: true,
        is_completed: false,
        sort_order: 3
      },
      {
        id: 'dddddddd-3030-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: 'cccccccc-5555-aaaa-aaaa-aaaaaaaaaaaa',
        shot_title: '[HERO] Entire CGC Media Crew & Organizing Committee Official Stage Group Photo',
        description: 'Full team commemorative group photo on main stage after all events conclude',
        is_required: true,
        is_completed: false,
        sort_order: 4
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
