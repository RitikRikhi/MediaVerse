import { api } from './api';
import { MediaAsset, MediaType } from '../types';

export interface DirectUploadProgress {
  percentage: number;
  loadedBytes: number;
  totalBytes: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
}

export interface DirectUploadOptions {
  file: File;
  assignmentId?: string;
  eventId?: string;
  mediaType: MediaType;
  targetFolderId?: string;
  targetFolderPath?: string;
  description?: string;
  tags?: string[];
  chunkSizeBytes?: number; // Defaults to 8 MiB (8388608 bytes)
  onProgress?: (progress: DirectUploadProgress) => void;
  signal?: AbortSignal;
  // Idempotency & Resumption parameters
  driveFileId?: string;       // If already uploaded to Google Drive, skip direct upload and only register!
  uploadUrl?: string;         // If session already created, query offset and resume instead of new session!
  queueItemId?: string;       // Stable batch item ID for tracking
  attempt?: number;           // Current attempt count (1-based)
}

export interface DirectUploadResult {
  success: boolean;
  asset?: MediaAsset;
  destination?: any;
  driveFileId?: string;
  driveWebUrl?: string;
  driveFolderUrl?: string;
  message?: string;
  error?: string;
  stage?: 'SESSION' | 'UPLOAD' | 'REGISTER';
  uploadUrl?: string;
}

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB (exact multiple of 256 KiB)
const MAX_CHUNK_RETRIES = 5;

const debugLog = (msg: string) => {
  if (process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && (window as any)?.__DEBUG_UPLOAD__)) {
    console.log(`[UploadEngine] ${msg}`);
  }
};

/**
 * Direct Browser-to-Google Drive Resumable Upload Engine
 * Streams large raw photos and 4K-10K videos (5-10 GB) directly to Google Drive
 * without routing video payloads through the Node.js backend.
 * Provides idempotent retries, session reconciliation, and granular state transitions.
 */
export async function uploadDirectToGoogleDrive(options: DirectUploadOptions): Promise<DirectUploadResult> {
  const { file, onProgress, signal, queueItemId = file.name, attempt = 1 } = options;
  const totalBytes = file.size;
  const chunkSizeBytes = options.chunkSizeBytes || DEFAULT_CHUNK_SIZE;

  const startTime = Date.now();
  let lastProgressTime = startTime;
  let lastLoadedBytes = 0;

  const reportProgress = (loadedBytes: number) => {
    if (!onProgress) return;
    const now = Date.now();
    const timeDiffSec = (now - lastProgressTime) / 1000;
    let speedBytesPerSec: number | undefined = undefined;
    let etaSeconds: number | undefined = undefined;

    if (timeDiffSec >= 0.5 && loadedBytes > lastLoadedBytes) {
      speedBytesPerSec = Math.round((loadedBytes - lastLoadedBytes) / timeDiffSec);
      const remainingBytes = Math.max(0, totalBytes - loadedBytes);
      etaSeconds = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : undefined;
      lastProgressTime = now;
      lastLoadedBytes = loadedBytes;
    }

    const percentage = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 100;
    onProgress({
      percentage,
      loadedBytes,
      totalBytes,
      speedBytesPerSec,
      etaSeconds
    });
  };

  // =========================================================================
  // IDEMPOTENCY CHECK: File already confirmed in Google Drive?
  // If driveFileId exists from an earlier attempt where registration failed,
  // skip binary upload completely and execute database registration directly!
  // =========================================================================
  if (options.driveFileId) {
    debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: REGISTER, fileId: ${options.driveFileId} - Reconciling already-uploaded Google Drive file...`);
    try {
      const driveWebUrl = `https://drive.google.com/file/d/${options.driveFileId}/view`;
      const completeRes = await api.completeDirectUpload({
        driveFileId: options.driveFileId,
        filename: file.name,
        fileSizeBytes: totalBytes,
        mimeType: file.type || 'application/octet-stream',
        driveWebUrl,
        assignmentId: options.assignmentId,
        eventId: options.eventId,
        mediaType: options.mediaType,
        targetFolderId: options.targetFolderId,
        targetFolderPath: options.targetFolderPath,
        description: options.description,
        tags: options.tags
      });

      reportProgress(totalBytes);
      debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: COMPLETED, fileId: ${options.driveFileId} - Registration reconciled successfully.`);

      return {
        success: true,
        asset: completeRes.asset,
        destination: completeRes.destination,
        driveFileId: options.driveFileId,
        driveWebUrl: completeRes.asset?.drive_web_url || driveWebUrl,
        driveFolderUrl: completeRes.destination?.driveFolderUrl,
        message: `Reconciled registration for ${file.name} (Drive ID: ${options.driveFileId})`,
        stage: 'REGISTER'
      };
    } catch (regErr: any) {
      debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: REGISTRATION_FAILED, fileId: ${options.driveFileId} - Registration retry error: ${regErr.message}`);
      return {
        success: false,
        driveFileId: options.driveFileId,
        error: `Database registration failed: ${regErr.message || 'Server error'}`,
        stage: 'REGISTER'
      };
    }
  }

  let uploadUrl = options.uploadUrl || '';
  let targetFolderId = options.targetFolderId || '';
  let targetFolderPath = options.targetFolderPath || '';
  let offset = 0;
  let finalGoogleData: any = null;

  // Helper: Query Google Drive for confirmed offset when network is interrupted
  const queryConfirmedOffset = async (sessionUrl: string): Promise<number | null> => {
    try {
      const res = await fetch(sessionUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes */${totalBytes}`
        }
      });

      if (res.status === 200 || res.status === 201) {
        finalGoogleData = await res.json().catch(() => ({}));
        return totalBytes;
      }

      if (res.status === 308) {
        const rangeHeader = res.headers.get('Range');
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=0-(\d+)/);
          if (match && match[1]) {
            return parseInt(match[1], 10) + 1;
          }
        }
        return 0; // Upload started but no bytes confirmed yet
      }

      if (res.status === 404 || res.status === 410) {
        debugLog(`[item: ${queueItemId}] Resumable session expired or not found (${res.status}).`);
        return -1; // Expired session
      }
    } catch (err) {
      console.warn('[DirectUploadEngine] Status query warning:', err);
    }
    return null;
  };

  try {
    // =========================================================================
    // Step 1: Session Initialization or Resumption
    // =========================================================================
    let needNewSession = true;

    if (uploadUrl) {
      debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: RECONCILE_SESSION - Querying Google for active offset...`);
      const confirmed = await queryConfirmedOffset(uploadUrl);
      if (confirmed === totalBytes && finalGoogleData) {
        debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: VERIFIED - Drive confirmed file fully received. Proceeding to registration.`);
        offset = totalBytes;
        needNewSession = false;
      } else if (confirmed !== null && confirmed >= 0) {
        debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: RESUME - Resuming from byte ${confirmed}/${totalBytes}.`);
        offset = confirmed;
        needNewSession = false;
      } else {
        debugLog(`[item: ${queueItemId}] Previous session expired or invalid. Requesting fresh session.`);
        uploadUrl = '';
      }
    }

    if (needNewSession) {
      debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: SESSION_REQUEST - Requesting resumable upload session...`);
      try {
        const session = await api.createUploadSession({
          filename: file.name,
          fileSizeBytes: totalBytes,
          mimeType: file.type || 'application/octet-stream',
          targetFolderId: options.targetFolderId,
          targetFolderPath: options.targetFolderPath,
          assignmentId: options.assignmentId,
          eventId: options.eventId,
          mediaType: options.mediaType,
          description: options.description
        });
        uploadUrl = session.uploadUrl;
        targetFolderId = session.targetFolderId;
        targetFolderPath = session.targetFolderPath;
        offset = 0;
        debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: SESSION_READY - Session created.`);
      } catch (sessionErr: any) {
        console.warn('[DirectUploadEngine] Direct session failed, falling back to server pipeline:', sessionErr.message);
        // Fallback: If session creation fails (e.g. offline dev), fallback to standard upload route
        const formData = new FormData();
        formData.append('file', file);
        if (options.assignmentId) formData.append('assignment_id', options.assignmentId);
        if (options.eventId) formData.append('event_id', options.eventId);
        formData.append('media_type', options.mediaType);
        formData.append('target_folder_id', options.targetFolderId || '');
        formData.append('target_folder_path', options.targetFolderPath || '');

        const fallbackRes = await api.uploadMediaFile(formData, (pct, loaded, total) => {
          reportProgress(loaded || 0);
        });

        return {
          success: true,
          asset: fallbackRes.asset,
          destination: fallbackRes.destination,
          driveFileId: fallbackRes.asset?.drive_file_id,
          driveWebUrl: fallbackRes.asset?.drive_web_url,
          driveFolderUrl: fallbackRes.destination?.driveFolderUrl,
          message: fallbackRes.message,
          stage: 'REGISTER'
        };
      }
    }

    // Helper: Upload a single chunk with XHR for accurate byte progress
    const uploadChunk = (startByte: number, endByte: number): Promise<{ status: number; data?: any }> => {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          return reject(new Error('Upload aborted by user.'));
        }

        const chunkBlob = file.slice(startByte, endByte);
        const xhr = new XMLHttpRequest();
        xhr.timeout = 45000; // 45s timeout per chunk prevents stalled sockets from hanging queue
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Range', `bytes ${startByte}-${endByte - 1}/${totalBytes}`);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        if (xhr.upload) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const currentOverallBytes = startByte + e.loaded;
              reportProgress(currentOverallBytes);
            }
          };
        }

        xhr.onload = () => {
          let responseJson = null;
          try {
            responseJson = JSON.parse(xhr.responseText);
          } catch {}
          resolve({ status: xhr.status, data: responseJson });
        };

        xhr.onerror = () => reject(new Error('Network error during chunk upload.'));
        xhr.ontimeout = () => reject(new Error('Upload chunk timed out.'));

        if (signal) {
          signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.send(chunkBlob);
      });
    };

    // =========================================================================
    // Step 2: Stream chunks directly to Google Drive
    // =========================================================================
    while (offset < totalBytes && !finalGoogleData) {
      if (signal?.aborted) {
        throw new Error('Upload aborted by user.');
      }

      const chunkEnd = Math.min(offset + chunkSizeBytes, totalBytes);
      let attemptNum = 0;
      let chunkSuccess = false;

      while (attemptNum <= MAX_CHUNK_RETRIES && !chunkSuccess) {
        try {
          const chunkRes = await uploadChunk(offset, chunkEnd);

          if (chunkRes.status === 200 || chunkRes.status === 201) {
            // Upload complete! Final metadata returned by Google
            finalGoogleData = chunkRes.data;
            chunkSuccess = true;
            offset = totalBytes;
            reportProgress(totalBytes);
            break;
          } else if (chunkRes.status === 308) {
            // Intermediate chunk confirmed by Google
            offset = chunkEnd;
            reportProgress(offset);
            chunkSuccess = true;
          } else if (chunkRes.status === 404 || chunkRes.status === 410) {
            throw new Error('Google Drive upload session expired. Please retry.');
          } else {
            throw new Error(`Google Drive responded with status ${chunkRes.status}`);
          }
        } catch (chunkErr: any) {
          attemptNum++;
          console.warn(`[DirectUploadEngine] [${queueItemId}] Chunk ${offset}-${chunkEnd} failed (attempt ${attemptNum}/${MAX_CHUNK_RETRIES}):`, chunkErr.message);

          if (attemptNum > MAX_CHUNK_RETRIES) {
            throw new Error(`Upload failed after ${MAX_CHUNK_RETRIES} retries: ${chunkErr.message}`);
          }

          // Backoff before retry
          const backoffMs = Math.min(1000 * Math.pow(2, attemptNum - 1), 8000);
          await new Promise(r => setTimeout(r, backoffMs));

          // Check confirmed offset with Google
          const confirmed = await queryConfirmedOffset(uploadUrl);
          if (confirmed !== null && confirmed >= 0) {
            offset = confirmed;
            if (offset >= totalBytes) {
              chunkSuccess = true;
              break;
            }
          }
        }
      }
    }

    // Fallback query if finished but metadata not parsed
    if (!finalGoogleData) {
      const confirmed = await queryConfirmedOffset(uploadUrl);
      if (confirmed === totalBytes && finalGoogleData) {
        // Retrieved successfully
      } else {
        throw new Error('Upload completed without receiving final Google Drive file confirmation.');
      }
    }

    const driveFileId = finalGoogleData.id;
    const driveWebUrl = finalGoogleData.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
    debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: REGISTER, fileId: ${driveFileId} - Direct Google Drive upload verified. Proceeding to database registration.`);

    // =========================================================================
    // Step 3: Register completed asset with backend for Supabase persistence
    // =========================================================================
    try {
      const completeRes = await api.completeDirectUpload({
        driveFileId,
        filename: file.name,
        fileSizeBytes: totalBytes,
        mimeType: file.type || 'application/octet-stream',
        driveWebUrl,
        driveThumbnailUrl: finalGoogleData.thumbnailLink,
        assignmentId: options.assignmentId,
        eventId: options.eventId,
        mediaType: options.mediaType,
        targetFolderId,
        targetFolderPath,
        description: options.description,
        tags: options.tags
      });

      reportProgress(totalBytes);
      debugLog(`[item: ${queueItemId}] attempt: ${attempt}, stage: COMPLETED, fileId: ${driveFileId} - Fully completed & registered!`);

      return {
        success: true,
        asset: completeRes.asset,
        destination: completeRes.destination,
        driveFileId,
        driveWebUrl,
        driveFolderUrl: completeRes.destination?.driveFolderUrl,
        message: `Successfully uploaded ${file.name} directly to Google Drive!`,
        stage: 'REGISTER',
        uploadUrl
      };
    } catch (regErr: any) {
      console.error(`[UploadEngine] [${queueItemId}] Database registration error for file ${driveFileId}:`, regErr);
      return {
        success: false,
        driveFileId, // PRESERVE confirmed Google Drive file ID!
        uploadUrl,   // PRESERVE session URL!
        error: `Database registration failed: ${regErr.message || 'Server error'}. Google Drive file confirmed (${driveFileId}).`,
        stage: 'REGISTER'
      };
    }
  } catch (err: any) {
    console.error(`[DirectUploadEngine] [${queueItemId}] Upload pipeline error:`, err);
    return {
      success: false,
      driveFileId: finalGoogleData?.id,
      uploadUrl,
      stage: finalGoogleData?.id ? 'REGISTER' : 'UPLOAD',
      error: err.message || 'Direct Google Drive upload failed.'
    };
  }
}
