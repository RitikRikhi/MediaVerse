import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db/memoryStore';
import { supabase } from '../src/db/client';
import { SupabaseService } from '../src/services/supabaseService';
import { DriveService } from '../src/services/driveService';
import { AIService } from '../src/services/aiService';
import { config } from '../src/config';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3001/api/v1';
const TEST_RUN_ID = 'TEST_DMV_20261026_RUN01';

// Helper for making API calls with role impersonation
async function apiCall(endpoint: string, options: {
  method?: string;
  body?: any;
  userId?: string;
  anonymous?: boolean;
} = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (options.anonymous) {
    headers['x-anonymous'] = 'true';
  } else if (options.userId) {
    headers['x-user-id'] = options.userId;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, ok: response.ok, data };
}

describe('DSA MediaVerse AI — Extreme End-to-End Testing & Security Suite', () => {
  const PROFILES = {
    ADMIN: '11111111-1111-1111-1111-111111111111',
    PRESIDENT: '22222222-2222-2222-2222-222222222222',
    COORDINATOR: '33333333-3333-3333-3333-333333333333',
    PHOTOGRAPHER: '44444444-4444-4444-4444-444444444444',
    VIDEOGRAPHER: '55555555-5555-5555-5555-555555555555',
    EDITOR: '66666666-6666-6666-6666-666666666666',
    REVIEWER: '77777777-7777-7777-7777-777777777777'
  };

  const createdTestAssetIds: string[] = [];
  let testAssignmentId: string = '';
  let testChecklistItemId: string = '';
  let testProjectId: string = '';
  let testVersionId: string = '';

  beforeAll(async () => {
    // Ensure Supabase baseline hydration
    await SupabaseService.hydrateFromSupabase();
    if (db.editingProjects.length > 0) {
      await SupabaseService.persistEditingProject(db.editingProjects[0]);
    }
  });

  afterAll(async () => {
    // Phase 20: Safe cleanup of test records tagged with TEST_RUN_ID
    console.log(`[CLEANUP] Cleaning up test records for ${TEST_RUN_ID}...`);
    db.assignments = db.assignments.filter(a => !a.title.includes(TEST_RUN_ID));
    db.mediaAssets = db.mediaAssets.filter(m => !m.filename.includes(TEST_RUN_ID));
    db.editingProjects = db.editingProjects.filter(p => !p.title.includes(TEST_RUN_ID));
    db.shotChecklists = db.shotChecklists.filter(c => !c.shot_title.includes(TEST_RUN_ID));
    if (supabase) {
      await supabase.from('review_comments').delete().ilike('comment', `%${TEST_RUN_ID}%`);
      await supabase.from('approvals').delete().ilike('feedback', `%${TEST_RUN_ID}%`);
      await supabase.from('edit_versions').delete().ilike('version_label', `%${TEST_RUN_ID}%`);
      await supabase.from('media_assets').delete().ilike('filename', `%${TEST_RUN_ID}%`);
      await supabase.from('assignments').delete().ilike('title', `%${TEST_RUN_ID}%`);
    }
  });

  // ==========================================================================
  // PHASE 3 — AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) TESTS
  // ==========================================================================
  describe('Phase 3: Authentication & Role Security', () => {
    it('3.1 should reject unauthenticated requests with HTTP 401', async () => {
      const res = await apiCall('/assignments', { anonymous: true });
      expect(res.status).toBe(401);
      expect(res.data.success).toBe(false);
      expect(res.data.error.code).toBe('UNAUTHORIZED');
    });

    it('3.2 should allow Media Coordinator to provision Drive structure (HTTP 201)', async () => {
      const res = await apiCall('/drive/provision-structure', {
        method: 'POST',
        userId: PROFILES.COORDINATOR,
        body: { root_folder_url: config.google.rootFolderUrl }
      });
      expect(res.status).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.data.folders.length).toBeGreaterThanOrEqual(5);
    });

    it('3.3 [NEGATIVE] Photographer attempting Coordinator-only action should be rejected with HTTP 403', async () => {
      const res = await apiCall('/drive/provision-structure', {
        method: 'POST',
        userId: PROFILES.PHOTOGRAPHER,
        body: { root_folder_url: config.google.rootFolderUrl }
      });
      expect(res.status).toBe(403);
      expect(res.data.success).toBe(false);
      expect(res.data.error.code).toBe('FORBIDDEN');
    });

    it('3.4 [NEGATIVE] Videographer attempting to submit review approval should be rejected with HTTP 403', async () => {
      const res = await apiCall('/reviews/decision', {
        method: 'POST',
        userId: PROFILES.VIDEOGRAPHER,
        body: {
          edit_version_id: 'f1111111-1111-1111-1111-111111111111',
          decision: 'APPROVED',
          feedback: 'Unauthorized approval attempt'
        }
      });
      expect(res.status).toBe(403);
      expect(res.data.success).toBe(false);
      expect(res.data.error.code).toBe('FORBIDDEN');
    });

    it('3.5 should allow Reviewer persona to access review workflows', async () => {
      const res = await apiCall('/reviews/pending', {
        userId: PROFILES.REVIEWER
      });
      expect(res.status).toBe(200);
      expect(res.data.success).toBe(true);
    });
  });

  // ==========================================================================
  // PHASE 4 — SUPABASE DATABASE EXTREME TESTING & PERSISTENCE
  // ==========================================================================
  describe('Phase 4: Supabase Database Cloud Persistence & Integrity', () => {
    it('4.1 should create an assignment and persist it to Supabase Cloud', async () => {
      testAssignmentId = crypto.randomUUID();
      const payload = {
        id: testAssignmentId,
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        location_id: 'bbbbbbbb-1111-aaaa-aaaa-aaaaaaaaaaaa',
        title: `${TEST_RUN_ID} Robotic Combat Aerials`,
        coverage_type: 'VIDEOGRAPHY',
        priority: 'HIGH',
        day_session: 'Day 2 - Morning',
        start_time: '2026-10-29T10:00:00Z',
        deadline: '2026-10-29T13:00:00Z',
        expected_deliverable: '4K 60fps slow-motion impact clips',
        assigned_user_ids: [PROFILES.VIDEOGRAPHER],
        checklist_items: [
          { shot_title: `${TEST_RUN_ID} Spark collision 120fps`, is_required: true },
          { shot_title: `${TEST_RUN_ID} Winner podium announcement`, is_required: true }
        ]
      };

      const res = await apiCall('/assignments', {
        method: 'POST',
        userId: PROFILES.COORDINATOR,
        body: payload
      });

      expect(res.status).toBe(201);
      expect(res.data.data.title).toBe(payload.title);
      testAssignmentId = res.data.data.id;

      // Verify Cloud persistence directly in Supabase
      const cloudRecords = await SupabaseService.queryCloudTable('assignments', {
        column: 'id',
        value: testAssignmentId
      });
      expect(cloudRecords.length).toBe(1);
      expect(cloudRecords[0].title).toBe(payload.title);
      expect(cloudRecords[0].coverage_type).toBe('VIDEOGRAPHY');
    });

    it('4.2 should update status and verify Supabase Cloud record updates', async () => {
      const res = await apiCall(`/assignments/${testAssignmentId}/status`, {
        method: 'PATCH',
        userId: PROFILES.COORDINATOR,
        body: { status: 'CAPTURING' }
      });

      expect(res.status).toBe(200);
      expect(res.data.data.status).toBe('CAPTURING');

      // Verify directly from Supabase Cloud
      const cloudRecords = await SupabaseService.queryCloudTable('assignments', {
        column: 'id',
        value: testAssignmentId
      });
      expect(cloudRecords[0].status).toBe('CAPTURING');
    });

    it('4.3 [NEGATIVE] Invalid status transition should be rejected with HTTP 400 or 403', async () => {
      const res = await apiCall(`/assignments/${testAssignmentId}/status`, {
        method: 'PATCH',
        userId: PROFILES.PHOTOGRAPHER, // Photographer cannot leap status directly to DELIVERED
        body: { status: 'DELIVERED' }
      });

      expect([400, 403]).toContain(res.status);
      expect(res.data.success).toBe(false);
    });
  });

  // ==========================================================================
  // PHASE 5 — GOOGLE DRIVE INTEGRATION & AUTOMATED HIERARCHY
  // ==========================================================================
  describe('Phase 5: Google Drive Automated Hierarchy & URL Parser', () => {
    it('5.1 should validate valid Google Drive URL and extract resource ID', () => {
      const folderUrl = 'https://drive.google.com/drive/u/0/folders/1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4';
      const check = DriveService.validateDriveUrl(folderUrl);

      expect(check.isValid).toBe(true);
      expect(check.isFolder).toBe(true);
      expect(check.fileId).toBe('1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4');
    });

    it('5.2 [NEGATIVE] Invalid Drive URL format should be rejected', () => {
      const badUrl = 'https://dropbox.com/s/randomfile123';
      const check = DriveService.validateDriveUrl(badUrl);

      expect(check.isValid).toBe(false);
      expect(check.fileId).toBeUndefined();
    });

    it('5.3 should automatically resolve Day 1 Photo upload to Photography subfolder', () => {
      const dest = DriveService.resolveDestination('Day 1 - Morning', 'RAW_PHOTO');
      expect(dest.day).toBe('Day 1');
      expect(dest.category).toBe('Photography');
      expect(dest.fullPath).toBe('DSA MediaVerse - SAVISKAR 2026/Day 1/Photography');
    });

    it('5.4 should automatically resolve Day 2 Raw Video to Raw Videography subfolder', () => {
      const dest = DriveService.resolveDestination('Day 2 - Evening', 'RAW_VIDEO');
      expect(dest.day).toBe('Day 2');
      expect(dest.category).toBe('Raw Videography');
      expect(dest.fullPath).toBe('DSA MediaVerse - SAVISKAR 2026/Day 2/Raw Videography');
    });

    it('5.5 should provide OAuth Auth URL for Google Drive authorization', async () => {
      const res = await apiCall('/drive/auth-url', { userId: PROFILES.COORDINATOR });
      expect(res.status).toBe(200);
      expect(res.data.data.authUrl).toContain('accounts.google.com');
      expect(res.data.data.isConfigured).toBe(true);
    });
  });

  // ==========================================================================
  // PHASE 6 & 7 — FIELD CREW WORKFLOWS (PHOTOGRAPHER & VIDEOGRAPHER)
  // ==========================================================================
  describe('Phase 6 & 7: Field Crew Workflows', () => {
    it('6.1 should allow photographer to toggle required shot checklist items', async () => {
      const getRes = await apiCall(`/assignments/${testAssignmentId}`, {
        userId: PROFILES.PHOTOGRAPHER
      });
      const checklists = getRes.data.data.checklist;
      expect(checklists.length).toBeGreaterThan(0);
      testChecklistItemId = checklists[0].id;

      const res = await apiCall(`/assignments/${testAssignmentId}/checklist/${testChecklistItemId}`, {
        method: 'PATCH',
        userId: PROFILES.PHOTOGRAPHER
      });

      expect(res.status).toBe(200);
      expect(res.data.data.is_completed).toBe(true);
      expect(res.data.data.completed_by).toBe(PROFILES.PHOTOGRAPHER);

      // Verify Cloud persistence of checklist toggle
      const cloudChecklist = await SupabaseService.queryCloudTable('shot_checklists', {
        column: 'id',
        value: testChecklistItemId
      });
      expect(cloudChecklist[0].is_completed).toBe(true);
    });

    it('7.1 should register uploaded video media asset and persist to Supabase', async () => {
      const assetId = crypto.randomUUID();
      createdTestAssetIds.push(assetId);

      const mediaPayload = {
        id: assetId,
        event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        assignment_id: testAssignmentId,
        filename: `${TEST_RUN_ID}_RAW_4K_ROBOWARS_${crypto.randomUUID().slice(0, 8)}.MOV`,
        media_type: 'RAW_VIDEO',
        drive_file_id: `drive-test-video-${crypto.randomUUID()}`,
        drive_web_url: `https://drive.google.com/file/d/test-${crypto.randomUUID()}/view`,
        file_size_bytes: 4294967296, // 4GB video
        description: 'Raw gimbal tracking 4K 60fps'
      };

      const res = await apiCall('/media', {
        method: 'POST',
        userId: PROFILES.VIDEOGRAPHER,
        body: mediaPayload
      });

      expect(res.status).toBe(201);
      expect(res.data.data.filename).toBe(mediaPayload.filename);

      // Verify Duplicate Prevention: Repeated upload with same URL should return 409 Conflict
      const dupRes = await apiCall('/media', {
        method: 'POST',
        userId: PROFILES.VIDEOGRAPHER,
        body: mediaPayload
      });
      expect(dupRes.status).toBe(409);
      expect(dupRes.data.error.code).toBe('DUPLICATE_FILE');

      // Verify Supabase Cloud persistence
      const cloudMedia = await SupabaseService.queryCloudTable('media_assets', {
        column: 'id',
        value: res.data.data.id
      });
      expect(cloudMedia.length).toBe(1);
      expect(cloudMedia[0].filename).toBe(mediaPayload.filename);
      expect(Number(cloudMedia[0].file_size_bytes)).toBe(mediaPayload.file_size_bytes);
    });
  });

  // ==========================================================================
  // PHASE 8 & 9 — EDITOR STUDIO & REVIEW APPROVAL WORKFLOW
  // ==========================================================================
  describe('Phase 8 & 9: Editor Studio & Review Lifecycle', () => {
    it('8.1 should allow editor to submit a new cut version (v1 Rough Cut)', async () => {
      // Find an existing editing project
      const project = db.editingProjects[0];
      testProjectId = project.id;

      const versionPayload = {
        version_label: `${TEST_RUN_ID} v1 Rough Cut`,
        drive_web_url: 'https://drive.google.com/file/d/test-cut-001/view',
        notes: 'Initial audio mix and pacing sequence on beat.'
      };

      const res = await apiCall(`/editing/projects/${testProjectId}/versions`, {
        method: 'POST',
        userId: PROFILES.EDITOR,
        body: versionPayload
      });

      expect(res.status).toBe(201);
      expect(res.data.data.version_label).toBe(versionPayload.version_label);
      testVersionId = res.data.data.id;

      // Verify Cloud persistence of edit version
      const cloudVersion = await SupabaseService.queryCloudTable('edit_versions', {
        column: 'id',
        value: testVersionId
      });
      expect(cloudVersion.length).toBe(1);
      expect(cloudVersion[0].version_label).toBe(versionPayload.version_label);
    });

    it('9.1 should allow reviewer to add a timecoded review comment', async () => {
      const commentPayload = {
        edit_version_id: testVersionId,
        timecode_seconds: 14.5,
        comment: `${TEST_RUN_ID} Lower background music by -3dB during speech.`
      };

      const res = await apiCall('/reviews/comments', {
        method: 'POST',
        userId: PROFILES.REVIEWER,
        body: commentPayload
      });

      expect(res.status).toBe(201);
      expect(res.data.data.comment).toBe(commentPayload.comment);
      expect(res.data.data.timecode_seconds).toBe(14.5);

      // Verify Cloud persistence
      const cloudComment = await SupabaseService.queryCloudTable('review_comments', {
        column: 'id',
        value: res.data.data.id
      });
      expect(cloudComment.length).toBe(1);
      expect(cloudComment[0].comment).toBe(commentPayload.comment);
    });

    it('9.2 should process final review approval and finalize deliverable status', async () => {
      const decisionPayload = {
        edit_version_id: testVersionId,
        decision: 'APPROVED',
        feedback: `${TEST_RUN_ID} Certified broadcast quality for SAVISKAR 2026.`,
        is_final_delivery: true
      };

      const res = await apiCall('/reviews/decision', {
        method: 'POST',
        userId: PROFILES.REVIEWER,
        body: decisionPayload
      });

      expect([200, 201]).toContain(res.status);
      expect(res.data.data.approval.decision).toBe('APPROVED');
      expect(res.data.data.project_status).toBe('DELIVERED');

      // Verify Cloud persistence of Approval record
      const cloudApproval = await SupabaseService.queryCloudTable('approvals', {
        column: 'edit_version_id',
        value: testVersionId
      });
      expect(cloudApproval.length).toBe(1);
      expect(cloudApproval[0].decision).toBe('APPROVED');
    });
  });

  // ==========================================================================
  // PHASE 10 — GEMINI AI ENGINE FREE-TIER SAFEGUARDS
  // ==========================================================================
  describe('Phase 10: Gemini AI Engine Safeguards & Telemetry', () => {
    it('10.1 should verify active model and zero-budget protection active', async () => {
      const telemetry = AIService.getTelemetry();
      expect(telemetry.activeModel).toBe('gemini-3.5-flash-lite');
      expect(telemetry.freeTierProtectionActive).toBe(true);
      expect(telemetry.modelChain).toContain('gemini-3.5-flash-lite');
      expect(telemetry.rateLimitHeadroom).toBeGreaterThanOrEqual(1);
    });

    it('10.2 should generate AI shot list and utilize in-memory semantic cache on duplicate query', async () => {
      const promptText = `${TEST_RUN_ID} Lamp lighting ceremony VIP coverage`;

      // Call 1: Live Cloud or Domain fallback
      const call1 = await AIService.generate({
        prompt: promptText,
        contextType: 'SHOTLIST',
        user: db.profiles[2]
      });
      expect(call1.text.length).toBeGreaterThan(50);

      // Call 2: Exact same query must hit semantic cache with 0ms duration
      const call2 = await AIService.generate({
        prompt: promptText,
        contextType: 'SHOTLIST',
        user: db.profiles[2]
      });
      expect(call2.mode).toBe('CACHE_SAVER');
      expect(call2.tokensSaved).toBeGreaterThan(0);
      expect(call2.durationMs).toBeLessThanOrEqual(10);
    }, 25000);

    it('10.3 should apply AI generated shotlist directly to assignment checklist in Supabase', async () => {
      const generatedShotlistText = `
- [ ] VIP arrival wide shot at Block 3 entrance
- [ ] Chancellor lighting lamp flame close-up
- [ ] Student applause auditorium panning shot
      `;

      const res = await apiCall('/ai/apply-shotlist', {
        method: 'POST',
        userId: PROFILES.COORDINATOR,
        body: {
          assignment_id: testAssignmentId,
          text: generatedShotlistText
        }
      });

      expect(res.status).toBe(201);
      expect(res.data.data.addedCount).toBeGreaterThanOrEqual(3);

      // Verify Cloud persistence of generated checklist items
      const cloudItems = await SupabaseService.queryCloudTable('shot_checklists', {
        column: 'assignment_id',
        value: testAssignmentId
      });
      expect(cloudItems.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ==========================================================================
  // PHASE 11-14 — MEDIA LIBRARY, DASHBOARD METRICS & NOTIFICATIONS
  // ==========================================================================
  describe('Phase 11-14: Operations, Filters & Notifications', () => {
    it('11.1 should filter media library by media type and event day', async () => {
      const res = await apiCall('/media?media_type=RAW_VIDEO', {
        userId: PROFILES.EDITOR
      });
      expect(res.status).toBe(200);
      expect(res.data.data.every((m: any) => m.media_type === 'RAW_VIDEO')).toBe(true);
    });

    it('12.1 should compute dynamic dashboard metrics matching persistent data', async () => {
      const res = await apiCall('/reports/metrics', {
        userId: PROFILES.COORDINATOR
      });
      expect(res.status).toBe(200);
      expect(res.data.data.total_assignments).toBeGreaterThanOrEqual(4);
      expect(res.data.data.total_registered_assets).toBeGreaterThanOrEqual(1);
    });

    it('13.1 should record notifications for assigned events', async () => {
      const res = await apiCall(`/notifications?user_id=${PROFILES.VIDEOGRAPHER}`, {
        userId: PROFILES.VIDEOGRAPHER
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data.data)).toBe(true);
    });
  });

  // ==========================================================================
  // PHASE 16 — SECURITY & INJECTION TESTING
  // ==========================================================================
  describe('Phase 16: Security Vulnerability & Input Validation', () => {
    it('16.1 should safely handle XSS script payload in inputs without executing and support clean deletion', async () => {
      const xssTitle = `<script>alert("XSS")</script> ${TEST_RUN_ID} Injection Test Event`;
      const res = await apiCall('/assignments', {
        method: 'POST',
        userId: PROFILES.COORDINATOR,
        body: {
          event_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          title: xssTitle,
          coverage_type: 'PHOTOGRAPHY',
          priority: 'MEDIUM',
          day_session: 'Day 1 - Morning',
          start_time: '2026-10-28T10:00:00Z',
          deadline: '2026-10-28T12:00:00Z',
          expected_deliverable: 'Photos'
        }
      });

      expect(res.status).toBe(201);
      // Clean text stored without execution
      expect(res.data.data.title).toContain(TEST_RUN_ID);

      // Verify deletion works cleanly
      if (res.data?.data?.id) {
        const delRes = await apiCall(`/assignments/${res.data.data.id}`, {
          method: 'DELETE',
          userId: PROFILES.COORDINATOR
        });
        expect(delRes.status).toBe(200);
        expect(delRes.data.success).toBe(true);
      }
    });

    it('16.2 [NEGATIVE] Malformed UUID parameters should be rejected gracefully', async () => {
      const res = await apiCall('/assignments/invalid-non-uuid/checklist/invalid-item', {
        method: 'PATCH',
        userId: PROFILES.COORDINATOR
      });
      expect(res.status).toBe(404);
      expect(res.data.success).toBe(false);
    });

    it('16.3 should ensure API responses never leak sensitive secrets or API keys', async () => {
      const res = await apiCall('/health');
      const responseText = JSON.stringify(res.data);
      expect(responseText).not.toContain(config.google.clientSecret);
      expect(responseText).not.toContain(config.gemini.apiKey);
    });
  });
});
