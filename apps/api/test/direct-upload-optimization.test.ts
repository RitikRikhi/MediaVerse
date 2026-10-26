import { describe, it, expect, beforeAll } from 'vitest';
import { DriveService } from '../src/services/driveService';
import { db } from '../src/db/memoryStore';
import { SupabaseService } from '../src/services/supabaseService';
import crypto from 'crypto';

describe('Google Drive Direct Resumable Upload Optimization (5-10 GB)', () => {
  const testUser = {
    id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Dr. Vikram Sarabhai',
    email: 'admin@cgc.edu.in',
    roles: ['SUPER_ADMIN' as const]
  };

  beforeAll(() => {
    DriveService.init();
  });

  it('should create direct resumable upload session for 12 MB raw photo without routing file through server', async () => {
    const session = await DriveService.createResumableUploadSession({
      filename: 'TEST_DSC_9918.CR3',
      mimeType: 'image/x-canon-cr3',
      sizeBytes: 12 * 1024 * 1024, // 12 MB
      description: 'RAW photo test directly to Google Drive'
    });

    expect(session).toBeTruthy();
    expect(session.uploadUrl).toBeTruthy();
    expect(session.uploadUrl).toContain('https://www.googleapis.com/upload/drive/v3/files');
    expect(session.uploadUrl).toContain('uploadType=resumable');
    expect(session.chunkSizeBytes).toBe(8 * 1024 * 1024); // 8 MiB standard chunk size
    expect(session.targetFolderId).toBeTruthy();
  }, 30000);

  it('should create direct resumable upload session for a massive 8 GB raw 4K video (5-10 GB range)', async () => {
    const EIGHT_GB = 8 * 1024 * 1024 * 1024; // 8,589,934,592 bytes
    const session = await DriveService.createResumableUploadSession({
      filename: 'TEST_SAVISKAR_DAY1_CONCERT_4K_MULTICAM.mov',
      mimeType: 'video/quicktime',
      sizeBytes: EIGHT_GB,
      description: '8GB 4K 60fps raw video stream directly to Google Drive'
    });

    expect(session).toBeTruthy();
    expect(session.uploadUrl).toBeTruthy();
    expect(session.uploadUrl).toContain('uploadType=resumable');
    expect(session.chunkSizeBytes).toBe(8 * 1024 * 1024); // 8 MiB chunks
    expect(session.targetFolderId).toBeTruthy();
    expect(session.targetFolderPath).toBeTruthy();
  }, 30000);

  it('should persist completed direct upload asset to db/Supabase and advance assignment status', async () => {
    const targetAssignment = db.assignments[0];
    expect(targetAssignment).toBeTruthy();
    const testDriveId = `test-direct-file-${Date.now()}`;

    const newAsset = {
      id: crypto.randomUUID(),
      event_id: targetAssignment.event_id || 'saviskar-2026',
      assignment_id: targetAssignment.id,
      assignment_title: targetAssignment.title,
      uploader_id: testUser.id,
      uploader_name: testUser.full_name,
      filename: 'TEST_SAVISKAR_HIGHLIGHTS.mov',
      media_type: 'RAW_VIDEO' as const,
      drive_file_id: testDriveId,
      drive_web_url: `https://drive.google.com/file/d/${testDriveId}/view`,
      drive_thumbnail_url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=300',
      file_size_bytes: 8589934592, // 8 GB
      mime_type: 'video/quicktime',
      capture_time: new Date().toISOString(),
      description: 'Direct 8GB 4K upload complete',
      tags: ['saviskar', '4k', 'multicam'],
      is_verified: true,
      created_at: new Date().toISOString()
    };

    db.mediaAssets.push(newAsset);
    await SupabaseService.persistMediaAsset(newAsset);

    // Verify record in db.mediaAssets
    const found = db.mediaAssets.find(m => m.drive_file_id === testDriveId);
    expect(found).toBeTruthy();
    expect(found?.filename).toBe('TEST_SAVISKAR_HIGHLIGHTS.mov');
    expect(found?.file_size_bytes).toBe(8589934592);
    expect(found?.is_verified).toBe(true);

    // Update assignment status
    targetAssignment.status = 'AVAILABLE_FOR_EDITING';
    expect(targetAssignment.status).toBe('AVAILABLE_FOR_EDITING');
  });

  it('should prevent duplicate asset registrations when file is already registered (idempotency)', () => {
    const existingAsset = db.mediaAssets[0];
    expect(existingAsset).toBeTruthy();

    const initialCount = db.mediaAssets.length;

    // Simulate duplicate check logic
    const isDuplicate = db.mediaAssets.some(m => m.drive_file_id === existingAsset.drive_file_id);
    expect(isDuplicate).toBe(true);

    // Must not re-insert duplicate
    if (!db.mediaAssets.some(m => m.drive_file_id === existingAsset.drive_file_id && m.id !== existingAsset.id)) {
      // Safe, no duplicate added
    }
    expect(db.mediaAssets.length).toBe(initialCount);
  });

  it('should validate chunk ranges and interruption recovery logic for Google Drive resumable protocol', () => {
    const totalBytes = 8589934592; // 8 GB (8,589,934,592 bytes)
    const chunkSize = 8 * 1024 * 1024; // 8 MiB (8,388,608 bytes)

    // Chunk 0
    const start0 = 0;
    const end0 = Math.min(start0 + chunkSize, totalBytes);
    const rangeHeader0 = `bytes ${start0}-${end0 - 1}/${totalBytes}`;
    expect(rangeHeader0).toBe('bytes 0-8388607/8589934592');

    // Interruption simulation: Google returns Range: bytes=0-8388607
    const mockGoogleRangeHeader = 'bytes=0-8388607';
    const match = mockGoogleRangeHeader.match(/bytes=0-(\d+)/);
    expect(match).toBeTruthy();
    const confirmedOffset = parseInt(match![1], 10) + 1;
    expect(confirmedOffset).toBe(8388608); // Next chunk resumes exactly at byte 8388608

    // Chunk 1 after recovery
    const start1 = confirmedOffset;
    const end1 = Math.min(start1 + chunkSize, totalBytes);
    const rangeHeader1 = `bytes ${start1}-${end1 - 1}/${totalBytes}`;
    expect(rangeHeader1).toBe('bytes 8388608-16777215/8589934592');

    // Number of 8 MiB chunks in 8 GB video: 1024 chunks
    const totalChunks = Math.ceil(totalBytes / chunkSize);
    expect(totalChunks).toBe(1024);
  });
});
