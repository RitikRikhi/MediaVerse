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
}

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB (exact multiple of 256 KiB)
const MAX_CHUNK_RETRIES = 5;

/**
 * Direct Browser-to-Google Drive Resumable Upload Engine
 * Streams large raw photos and 4K-10K videos (5-10 GB) directly to Google Drive
 * without routing video payloads through the Node.js backend.
 */
export async function uploadDirectToGoogleDrive(options: DirectUploadOptions): Promise<DirectUploadResult> {
  const { file, onProgress, signal } = options;
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

  try {
    // Step 1: Request resumable session from backend (backend signs with master OAuth token)
    let session: { uploadUrl: string; targetFolderId: string; targetFolderPath: string };
    try {
      session = await api.createUploadSession({
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
        message: fallbackRes.message
      };
    }

    const uploadUrl = session.uploadUrl;
    let offset = 0;
    let finalGoogleData: any = null;

    // Helper: Query Google Drive for confirmed offset when network is interrupted
    const queryConfirmedOffset = async (): Promise<number | null> => {
      try {
        const res = await fetch(uploadUrl, {
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
          return 0; // Upload started but no bytes confirmed
        }
      } catch (err) {
        console.warn('[DirectUploadEngine] Status query warning:', err);
      }
      return null;
    };

    // Helper: Upload a single chunk with XHR for accurate byte progress
    const uploadChunk = (startByte: number, endByte: number): Promise<{ status: number; data?: any }> => {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          return reject(new Error('Upload aborted by user.'));
        }

        const chunkBlob = file.slice(startByte, endByte);
        const xhr = new XMLHttpRequest();
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

    // Step 2: Stream chunks directly to Google Drive
    while (offset < totalBytes && !finalGoogleData) {
      if (signal?.aborted) {
        throw new Error('Upload aborted by user.');
      }

      const chunkEnd = Math.min(offset + chunkSizeBytes, totalBytes);
      let attempt = 0;
      let chunkSuccess = false;

      while (attempt <= MAX_CHUNK_RETRIES && !chunkSuccess) {
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
          attempt++;
          console.warn(`[DirectUploadEngine] Chunk ${offset}-${chunkEnd} failed (attempt ${attempt}/${MAX_CHUNK_RETRIES}):`, chunkErr.message);

          if (attempt > MAX_CHUNK_RETRIES) {
            throw new Error(`Upload failed after ${MAX_CHUNK_RETRIES} retries: ${chunkErr.message}`);
          }

          // Backoff before retry
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          await new Promise(r => setTimeout(r, backoffMs));

          // Check confirmed offset with Google
          const confirmed = await queryConfirmedOffset();
          if (confirmed !== null) {
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
      const confirmed = await queryConfirmedOffset();
      if (confirmed === totalBytes && finalGoogleData) {
        // Retrieved
      } else {
        throw new Error('Upload completed without receiving final Google Drive file confirmation.');
      }
    }

    const driveFileId = finalGoogleData.id;
    const driveWebUrl = finalGoogleData.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;

    // Step 3: Register completed asset with backend for Supabase persistence & status updates
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
      targetFolderId: session.targetFolderId,
      targetFolderPath: session.targetFolderPath,
      description: options.description,
      tags: options.tags
    });

    reportProgress(totalBytes);

    return {
      success: true,
      asset: completeRes.asset,
      destination: completeRes.destination,
      driveFileId,
      driveWebUrl,
      driveFolderUrl: completeRes.destination?.driveFolderUrl,
      message: `Successfully uploaded ${file.name} directly to Google Drive!`
    };
  } catch (err: any) {
    console.error('[DirectUploadEngine] Upload failed:', err);
    return {
      success: false,
      error: err.message || 'Direct Google Drive upload failed.'
    };
  }
}
