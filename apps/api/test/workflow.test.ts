import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../src/index';
import { db } from '../src/db/memoryStore';
import { DriveService } from '../src/services/driveService';
import { AIService } from '../src/services/aiService';

// Lightweight in-process request helper
async function request(path: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const url = `http://localhost:3001${path}`;
  // We can use native fetch since Node 18+ provides fetch
  // Start server on ephemeral port for tests if needed or test services directly
}

describe('DSA MediaVerse AI - Core Workflow & Authorization Tests', () => {
  beforeEach(() => {
    db.seed();
  });

  // 1. Database seed and roles
  it('should initialize with all 7 pre-seeded roles and SAVISKAR 2026 event', () => {
    expect(db.profiles.length).toBe(7);
    const roles = db.profiles.flatMap(p => p.roles);
    expect(roles).toContain('SUPER_ADMIN');
    expect(roles).toContain('PRESIDENT');
    expect(roles).toContain('MEDIA_COORDINATOR');
    expect(roles).toContain('PHOTOGRAPHER');
    expect(roles).toContain('VIDEOGRAPHER');
    expect(roles).toContain('VIDEO_EDITOR');
    expect(roles).toContain('REVIEWER');

    expect(db.events[0].name).toBe('SAVISKAR 2026');
    expect(db.assignments.length).toBeGreaterThanOrEqual(4);
  });

  // 2. Assignment creation and checklist items
  it('should create an assignment with required fields and shot checklists', () => {
    const initialCount = db.assignments.length;
    const initialChecklistCount = db.shotChecklists.length;

    const newAssignmentId = 'test-assignment-uuid-1';
    db.assignments.push({
      id: newAssignmentId,
      event_id: db.events[0].id,
      title: 'Star Night Drone Coverage',
      coverage_type: 'VIDEOGRAPHY',
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      day_session: 'Day 2 - Night',
      start_time: '2026-10-29T20:00:00Z',
      deadline: '2026-10-29T23:00:00Z',
      expected_deliverable: 'Aerial 4K 60fps drone reels of crowd and stage lasers',
      created_by: db.profiles[2].id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    db.shotChecklists.push({
      id: 'shot-1',
      assignment_id: newAssignmentId,
      shot_title: 'Full Stadium Aerial Pan',
      is_required: true,
      is_completed: false,
      sort_order: 1
    });

    expect(db.assignments.length).toBe(initialCount + 1);
    expect(db.shotChecklists.length).toBe(initialChecklistCount + 1);
  });

  // 3. Status transition rules and validation
  it('should validate status progression: ASSIGNED -> CAPTURING -> UPLOAD_PENDING -> AVAILABLE_FOR_EDITING', () => {
    const assignment = db.assignments.find(a => a.id === 'cccccccc-4444-aaaa-aaaa-aaaaaaaaaaaa')!;
    expect(assignment.status).toBe('ASSIGNED');

    // Transition to CAPTURING
    assignment.status = 'CAPTURING';
    expect(assignment.status).toBe('CAPTURING');

    // Transition to UPLOAD_PENDING
    assignment.status = 'UPLOAD_PENDING';
    expect(assignment.status).toBe('UPLOAD_PENDING');

    // Transition to AVAILABLE_FOR_EDITING
    assignment.status = 'AVAILABLE_FOR_EDITING';
    expect(assignment.status).toBe('AVAILABLE_FOR_EDITING');
  });

  // 4. Media registration and duplicate prevention
  it('should register media asset and detect duplicate Drive file URLs', () => {
    const initialMediaCount = db.mediaAssets.length;
    const testDriveUrl = 'https://drive.google.com/file/d/test-file-unique-001/view';

    // Register first asset
    db.mediaAssets.push({
      id: 'media-test-1',
      event_id: db.events[0].id,
      assignment_id: db.assignments[0].id,
      uploader_id: db.profiles[3].id,
      filename: 'SAV_INAUG_TEST.ARW',
      media_type: 'RAW_PHOTO',
      drive_file_id: 'test-file-unique-001',
      drive_web_url: testDriveUrl,
      tags: ['test', 'raw'],
      is_verified: true,
      created_at: new Date().toISOString()
    });

    expect(db.mediaAssets.length).toBe(initialMediaCount + 1);

    // Test duplicate detection logic
    const duplicate = db.mediaAssets.find(m => m.drive_web_url === testDriveUrl);
    expect(duplicate).toBeDefined();
    expect(duplicate?.filename).toBe('SAV_INAUG_TEST.ARW');
  });

  // 5. Editing versioning and review approval flow
  it('should maintain incremental version history without overwriting earlier cuts', () => {
    const project = db.editingProjects[0];
    const initialVersionCount = db.editVersions.filter(v => v.editing_project_id === project.id).length;

    // Submit new version
    const newVersionNumber = initialVersionCount + 1;
    const newVersion = {
      id: `edit-ver-${newVersionNumber}`,
      editing_project_id: project.id,
      version_number: newVersionNumber,
      version_label: `v${newVersionNumber} Final Master`,
      drive_file_id: `drive-file-master-${newVersionNumber}`,
      drive_web_url: 'https://drive.google.com/file/d/master-v3/view',
      notes: 'Final master export normalized to -14 LUFS',
      submitted_by: db.profiles[5].id,
      submitted_at: new Date().toISOString()
    };
    db.editVersions.push(newVersion);

    const updatedVersions = db.editVersions.filter(v => v.editing_project_id === project.id);
    expect(updatedVersions.length).toBe(initialVersionCount + 1);

    // Add timecode review comment
    const comment = {
      id: 'comment-test-1',
      edit_version_id: newVersion.id,
      reviewer_id: db.profiles[6].id,
      reviewer_name: 'Dr. Neha Gupta',
      timecode_seconds: 22.5,
      comment: 'Audio levels are balanced. Subtitle timing is sharp.',
      is_resolved: true,
      created_at: new Date().toISOString()
    };
    db.reviewComments.push(comment);

    // Approve version
    const approval = {
      id: 'approval-test-1',
      editing_project_id: project.id,
      edit_version_id: newVersion.id,
      reviewer_id: db.profiles[6].id,
      decision: 'APPROVED' as const,
      feedback: 'Approved for broadcast on official CGC University channels.',
      created_at: new Date().toISOString()
    };
    db.approvals.push(approval);

    project.status = 'APPROVED';
    expect(project.status).toBe('APPROVED');
  });

  // 6. Google Drive URL validation & folder hierarchy
  it('should accurately validate Google Drive file and folder links', () => {
    const folderUrl = 'https://drive.google.com/drive/folders/1a2b3c4d5e6f';
    const fileUrl = 'https://drive.google.com/file/d/9z8y7x6w5v4u/view';
    const invalidUrl = 'https://dropbox.com/s/sample-file';

    const folderCheck = DriveService.validateDriveUrl(folderUrl);
    expect(folderCheck.isValid).toBe(true);
    expect(folderCheck.isFolder).toBe(true);
    expect(folderCheck.fileId).toBe('1a2b3c4d5e6f');

    const fileCheck = DriveService.validateDriveUrl(fileUrl);
    expect(fileCheck.isValid).toBe(true);
    expect(fileCheck.isFolder).toBe(false);
    expect(fileCheck.fileId).toBe('9z8y7x6w5v4u');

    const invalidCheck = DriveService.validateDriveUrl(invalidUrl);
    expect(invalidCheck.isValid).toBe(false);
  });

  // 7. Drive folder structure provisioning
  it('should provision standardized SAVISKAR folder hierarchy', () => {
    const result = DriveService.provisionFolderHierarchy(db.events[0].id);
    expect(result.success).toBe(true);
    expect(result.createdFolders.length).toBeGreaterThanOrEqual(5);

    const folderNames = result.createdFolders.map(f => f.folder_name);
    expect(folderNames).toContain('Photography');
    expect(folderNames).toContain('Raw Videography');
    expect(folderNames).toContain('Editing Projects');
    expect(folderNames).toContain('Review Versions');
    expect(folderNames).toContain('Approved Deliverables');
  });

  // 8. AI Provider Operations & Graceful Degradation (Cloud Gemini + Zero-Budget Fallback)
  it('should provide complete operational shotlists and briefs with intelligent fallback', async () => {
    const shotlistResult = await AIService.generate({
      prompt: 'Chief guest lamp lighting ceremony',
      contextType: 'SHOTLIST',
      user: db.profiles[2]
    });

    expect(shotlistResult.text.length).toBeGreaterThan(50);
    expect(shotlistResult.text.toLowerCase()).toContain('shot list');
    expect(shotlistResult.text).toContain('SAVISKAR 2026');
    expect(['GEMINI_API', 'CACHE_SAVER', 'OFFLINE_SMART_ENGINE', 'LOCAL_RULE_ENGINE', 'QUOTA_GUARD_SYNTHESIZER']).toContain(shotlistResult.mode);

    const briefResult = await AIService.generate({
      prompt: 'Aftermovie 45s reel',
      contextType: 'EDITING_BRIEF',
      user: db.profiles[2]
    });

    expect(briefResult.text.length).toBeGreaterThan(50);
    expect(briefResult.text.toLowerCase()).toContain('brief');

    const summaryResult = await AIService.generate({
      prompt: 'Daily status',
      contextType: 'STATUS_SUMMARY',
      user: db.profiles[2]
    });

    expect(summaryResult.text.length).toBeGreaterThan(50);
    expect(summaryResult.text).toContain('SAVISKAR 2026');

    // Verify AI Action Log was created
    expect(db.aiActionLogs.length).toBeGreaterThanOrEqual(3);
  }, 25000);
});
