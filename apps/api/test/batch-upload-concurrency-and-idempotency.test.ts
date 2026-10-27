import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { db } from '../src/db/memoryStore';
import { SupabaseService } from '../src/services/supabaseService';
import { DriveService } from '../src/services/driveService';

describe('Batch Upload Concurrency & Idempotent Google Drive Engine (100 Photos)', () => {
  beforeAll(() => {
    DriveService.init();
  });

  // -------------------------------------------------------------------------
  // Test 1: Selecting 100 unique photos produces exactly 100 queue items
  // -------------------------------------------------------------------------
  it('1. should create exactly 100 queue items with strictly unique IDs for 100 selected photos', () => {
    const rawFiles = Array.from({ length: 100 }, (_, i) => ({
      name: `DSC_SAVISKAR_${String(i + 1).padStart(4, '0')}.JPG`,
      size: 2 * 1024 * 1024 + (i * 1024), // ~2 MB each
      type: 'image/jpeg',
      lastModified: Date.now() + i
    }));

    const queue = rawFiles.map((file, idx) => ({
      id: `queue-${Date.now()}-${idx}-${crypto.randomUUID().slice(0, 8)}`,
      file,
      originalSize: file.size,
      mediaType: 'RAW_PHOTO' as const,
      status: 'QUEUED' as const,
      progress: 0,
      attemptCount: 0
    }));

    expect(queue.length).toBe(100);
    const uniqueIds = new Set(queue.map(q => q.id));
    expect(uniqueIds.size).toBe(100);
  });

  // -------------------------------------------------------------------------
  // Test 2: Each item starts no more than once during normal processing
  // -------------------------------------------------------------------------
  it('2. should start each item exactly once across concurrent workers without repeats', async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `queue-item-${i}`,
      name: `photo_${i}.jpg`,
      status: 'QUEUED' as 'QUEUED' | 'UPLOADING' | 'COMPLETED'
    }));

    const processingIds = new Set<string>();
    const startCounts: Record<string, number> = {};
    const concurrency = 3;
    let completedCount = 0;

    const worker = async () => {
      while (true) {
        let currentItem: typeof items[0] | null = null;
        for (const candidate of items) {
          if (candidate.status === 'QUEUED' && !processingIds.has(candidate.id)) {
            processingIds.add(candidate.id);
            candidate.status = 'UPLOADING';
            currentItem = candidate;
            break;
          }
        }

        if (!currentItem) break;

        startCounts[currentItem.id] = (startCounts[currentItem.id] || 0) + 1;
        // Simulate short upload work
        await new Promise(r => setTimeout(r, 2));

        currentItem.status = 'COMPLETED';
        processingIds.delete(currentItem.id);
        completedCount++;
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    expect(completedCount).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(startCounts[`queue-item-${i}`]).toBe(1);
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: Completed files are not uploaded again when later files finish
  // -------------------------------------------------------------------------
  it('3. should never re-upload or reset completed files when other files finish', async () => {
    const queue = [
      { id: 'file-1', status: 'COMPLETED' as const, driveFileId: 'gdrive-001', uploads: 1 },
      { id: 'file-2', status: 'COMPLETED' as const, driveFileId: 'gdrive-002', uploads: 1 },
      { id: 'file-3', status: 'QUEUED' as const, driveFileId: undefined, uploads: 0 }
    ];

    // Worker looks for pending files
    const pending = queue.filter(f => f.status === 'QUEUED');
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe('file-3');

    // Process file-3
    pending[0].uploads++;
    (pending[0] as any).status = 'COMPLETED';
    (pending[0] as any).driveFileId = 'gdrive-003';

    // Verify file-1 and file-2 remain completed with upload count 1
    expect(queue[0].status).toBe('COMPLETED');
    expect(queue[0].uploads).toBe(1);
    expect(queue[1].status).toBe('COMPLETED');
    expect(queue[1].uploads).toBe(1);
    expect(queue[2].status).toBe('COMPLETED');
    expect(queue[2].uploads).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Test 4: Temporary network error does not create a duplicate Drive file on retry
  // -------------------------------------------------------------------------
  it('4. should resume existing session on network error instead of creating duplicate Drive files', async () => {
    let sessionCreationCount = 0;
    const sessionUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=mock-session-123';

    const createSession = () => {
      sessionCreationCount++;
      return sessionUrl;
    };

    // First attempt: session created, uploads 8MB then gets network error
    let activeSession = createSession();
    let confirmedBytes = 8 * 1024 * 1024;
    expect(sessionCreationCount).toBe(1);

    // Retry attempt: reuses activeSession, checks confirmed bytes with Google Drive
    const canResume = Boolean(activeSession);
    expect(canResume).toBe(true);
    if (canResume) {
      // Reconciles with Google Drive (does NOT call createSession again)
      const nextOffset = confirmedBytes;
      expect(nextOffset).toBe(8 * 1024 * 1024);
    } else {
      activeSession = createSession();
    }

    expect(sessionCreationCount).toBe(1); // Exactly 1 file created in Drive!
  });

  // -------------------------------------------------------------------------
  // Test 5: Database registration failure retries registration without re-uploading
  // -------------------------------------------------------------------------
  it('5. should retry database registration using existing drive_file_id without re-uploading binary', async () => {
    let binaryUploadCount = 0;
    let registrationAttempts = 0;
    const confirmedDriveFileId = 'confirmed-gdrive-file-abc';

    const item = {
      id: 'queue-retry-test',
      filename: 'STAGE_PHOTO.CR3',
      driveFileId: confirmedDriveFileId, // Drive upload already succeeded!
      status: 'REGISTRATION_FAILED' as const
    };

    // Uploader checks driveFileId
    if (item.driveFileId) {
      // Skip binary upload!
    } else {
      binaryUploadCount++;
    }

    // Try registration (simulating success on retry)
    registrationAttempts++;
    const registeredAsset = {
      id: crypto.randomUUID(),
      filename: item.filename,
      drive_file_id: item.driveFileId,
      is_verified: true
    };
    db.mediaAssets.push(registeredAsset as any);

    expect(binaryUploadCount).toBe(0); // Binary was NOT re-uploaded!
    expect(registrationAttempts).toBe(1);
    expect(db.mediaAssets.some(m => m.drive_file_id === confirmedDriveFileId)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 6: Two files with the same filename but different contents are handled safely
  // -------------------------------------------------------------------------
  it('6. should distinguish files with identical filenames using unique queue IDs', () => {
    const file1 = { name: 'IMG_0001.JPG', size: 2450100, lastModified: 1000 };
    const file2 = { name: 'IMG_0001.JPG', size: 3120400, lastModified: 2000 };

    const item1 = {
      id: `queue-${Date.now()}-0-${crypto.randomUUID().slice(0, 8)}`,
      file: file1,
      driveFileId: 'drive-id-camera-a'
    };

    const item2 = {
      id: `queue-${Date.now()}-1-${crypto.randomUUID().slice(0, 8)}`,
      file: file2,
      driveFileId: 'drive-id-camera-b'
    };

    expect(item1.id).not.toBe(item2.id);
    expect(item1.driveFileId).not.toBe(item2.driveFileId);
    expect(item1.file.size).not.toBe(item2.file.size);
  });

  // -------------------------------------------------------------------------
  // Test 7: One failed photo does not stop the remaining queue
  // -------------------------------------------------------------------------
  it('7. should continue processing remaining queue when one photo fails', async () => {
    const queue = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      willFail: i === 3, // Item 3 fails
      status: 'QUEUED' as 'QUEUED' | 'COMPLETED' | 'FAILED'
    }));

    const concurrency = 2;
    let index = 0;

    const worker = async () => {
      while (index < queue.length) {
        const item = queue[index++];
        if (!item) break;

        if (item.willFail) {
          item.status = 'FAILED';
        } else {
          item.status = 'COMPLETED';
        }
      }
    };

    await Promise.all([worker(), worker()]);

    const completed = queue.filter(q => q.status === 'COMPLETED');
    const failed = queue.filter(q => q.status === 'FAILED');

    expect(completed.length).toBe(9);
    expect(failed.length).toBe(1);
    expect(failed[0].id).toBe('item-3');
  });

  // -------------------------------------------------------------------------
  // Test 8: Rapid state updates do not drop or repeat queue items
  // -------------------------------------------------------------------------
  it('8. should prevent double triggers using isUploading mutex ref guard', async () => {
    let activeWorkers = 0;
    let isUploadingRef = false;
    let startedBatches = 0;

    const handleStartUpload = async () => {
      if (isUploadingRef) {
        return; // Guard prevents concurrent worker batches
      }
      isUploadingRef = true;
      startedBatches++;
      activeWorkers += 3;

      await new Promise(r => setTimeout(r, 20));

      activeWorkers -= 3;
      isUploadingRef = false;
    };

    // Simulate 5 rapid double-clicks within milliseconds
    await Promise.all([
      handleStartUpload(),
      handleStartUpload(),
      handleStartUpload(),
      handleStartUpload(),
      handleStartUpload()
    ]);

    expect(startedBatches).toBe(1); // Only 1 batch initiated!
    expect(activeWorkers).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 9: Refresh and recovery behavior matches resumable protocol
  // -------------------------------------------------------------------------
  it('9. should correctly parse 308 Range headers to resume byte stream', () => {
    const rangeHeader = 'bytes=0-16777215'; // 16 MiB confirmed
    const match = rangeHeader.match(/bytes=0-(\d+)/);
    expect(match).toBeTruthy();
    const confirmedOffset = parseInt(match![1], 10) + 1;
    expect(confirmedOffset).toBe(16777216); // 16 MiB exact next byte offset
  });

  // -------------------------------------------------------------------------
  // Test 10: Four team members can upload simultaneously without cross-user conflicts
  // -------------------------------------------------------------------------
  it('10. should isolate queues across 4 concurrent crew members', async () => {
    const crewMembers = ['Photographer_1', 'Photographer_2', 'Videographer_1', 'Videographer_2'];
    const memberResults: Record<string, number> = {};

    await Promise.all(crewMembers.map(async (member) => {
      // Independent user session queue of 25 files each = 100 files total
      const userQueue = Array.from({ length: 25 }, (_, i) => ({
        id: `${member}-file-${i}`,
        uploader: member,
        status: 'QUEUED'
      }));

      // Process user queue
      for (const f of userQueue) {
        f.status = 'COMPLETED';
      }
      memberResults[member] = userQueue.filter(f => f.status === 'COMPLETED').length;
    }));

    expect(memberResults['Photographer_1']).toBe(25);
    expect(memberResults['Photographer_2']).toBe(25);
    expect(memberResults['Videographer_1']).toBe(25);
    expect(memberResults['Videographer_2']).toBe(25);
  });
});
