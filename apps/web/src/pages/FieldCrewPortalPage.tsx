import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Assignment, ShotChecklistItem, MediaType, MediaAsset, PersonalDriveInfo, PersonalSubfolder } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { Modal } from '../components/ui/Modal';
import { InteractiveFolderTree } from '../components/drive/InteractiveFolderTree';
import { optimizeImageFile } from '../lib/imageOptimizer';
import { uploadDirectToGoogleDrive } from '../lib/driveUploadEngine';
import {
  Camera,
  Film,
  CheckSquare,
  Square,
  UploadCloud,
  FolderOpen,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Zap,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Image as ImageIcon,
  Check,
  HardDrive,
  FolderPlus,
  Edit2,
  Layers,
  Plus
} from 'lucide-react';

interface QueuedFile {
  id: string;
  file: File;
  originalFile: File;
  originalSize: number;
  previewUrl?: string;
  mediaType: MediaType;
  status: 'QUEUED' | 'OPTIMIZING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  progress: number;
  loadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  error?: string;
  driveWebUrl?: string;
  driveFolderUrl?: string;
  isOptimized?: boolean;
  reductionPercent?: number;
}

export const FieldCrewPortalPage: React.FC = () => {
  const { user, activeRole, isPhotographer, isVideographer, setShowAuthModal } = useAuth();
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { checklist: ShotChecklistItem[] }) | null>(null);
  const [assignedMedia, setAssignedMedia] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Role Station Filter: 'PHOTO' | 'VIDEO' | 'ALL'
  const getInitialMediaFilter = (): 'PHOTO' | 'VIDEO' | 'ALL' => {
    if (activeRole === 'PHOTOGRAPHER' || isPhotographer) return 'PHOTO';
    if (activeRole === 'VIDEOGRAPHER' || isVideographer) return 'VIDEO';
    return 'ALL';
  };

  const [roleMediaFilter, setRoleMediaFilter] = useState<'PHOTO' | 'VIDEO' | 'ALL'>(getInitialMediaFilter);

  useEffect(() => {
    setRoleMediaFilter(getInitialMediaFilter());
  }, [activeRole]);

  // Active view tab inside the workspace: 'upload' | 'checklist' | 'media'
  const [activeTab, setActiveTab] = useState<'upload' | 'checklist' | 'media'>('upload');

  // Day filter for left task list
  const [dayFilter, setDayFilter] = useState<'ALL' | 'DAY_1' | 'DAY_2'>('ALL');

  // Turbo Event Compression Mode (On by default for high-speed event Wi-Fi uploads)
  const [turboMode, setTurboMode] = useState<boolean>(true);

  // Upload Queue State
  const [uploadFiles, setUploadFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSummaryMessage, setUploadSummaryMessage] = useState('');
  const [destinationFolderInfo, setDestinationFolderInfo] = useState<any>(null);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('');
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [authSuccessBanner, setAuthSuccessBanner] = useState<boolean>(false);

  // Personal User Drive State & Destination Mode
  const [personalDrive, setPersonalDrive] = useState<PersonalDriveInfo | null>(null);
  const [personalDriveLoading, setPersonalDriveLoading] = useState<boolean>(false);
  const [destinationMode, setDestinationMode] = useState<'OFFICIAL' | 'PERSONAL'>('OFFICIAL');
  const [showPersonalDriveDrawer, setShowPersonalDriveDrawer] = useState<boolean>(true);
  const [newSubfolderName, setNewSubfolderName] = useState<string>('');
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState<boolean>(false);
  const [editingSubfolderId, setEditingSubfolderId] = useState<string | null>(null);
  const [editingSubfolderName, setEditingSubfolderName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const uploadFilesRef = useRef<QueuedFile[]>([]);

  useEffect(() => {
    uploadFilesRef.current = uploadFiles;
  }, [uploadFiles]);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAssignments({ my_assignments: true });
      const list = data.length > 0 ? data : await api.getAssignments();
      setMyAssignments(list);

      if (list.length > 0 && !selectedAssignment) {
        await selectAssignment(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load assignments', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectAssignment = async (id: string) => {
    try {
      const [detail, media] = await Promise.all([
        api.getAssignment(id),
        api.getMediaAssets({ assignment_id: id })
      ]);
      setSelectedAssignment(detail);
      setAssignedMedia(media);

      // Auto resolve folder destination
      const mediaType = detail.coverage_type === 'VIDEOGRAPHY' ? 'RAW_VIDEO' : 'RAW_PHOTO';
      const dest = await api.getResolvedDestination(detail.day_session, mediaType);
      setDestinationFolderInfo(dest);

      // Initialize selected folder from verified drive folder ID if in official mode
      if (destinationMode === 'OFFICIAL' && dest?.driveFolderId) {
        setSelectedFolderId(dest.driveFolderId);
        setSelectedFolderPath(dest.fullPath || dest.folderName);
      }
    } catch (err) {
      console.error('Failed to select assignment', err);
    }
  };

  const loadPersonalDrive = async () => {
    try {
      setPersonalDriveLoading(true);
      const pd = await api.getMyDrive();
      setPersonalDrive(pd);
    } catch (err) {
      console.warn('Could not load personal drive:', err);
    } finally {
      setPersonalDriveLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
    loadPersonalDrive();

    const query = new URLSearchParams(window.location.search);
    if (query.get('connected') === 'true') {
      setAuthSuccessBanner(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    api.getDriveStatus()
      .then(setDriveStatus)
      .catch(err => console.error('Failed to load drive status', err));

    api.getDriveFolderStructure()
      .then(res => {
        if (res && res.flatList && res.flatList.length > 0) {
          setDriveFolders(res.flatList);
          if (!selectedFolderPath) {
            setSelectedFolderPath(res.flatList[0].path);
            if (res.flatList[0].driveFolderId) setSelectedFolderId(res.flatList[0].driveFolderId);
          }
        }
      })
      .catch(err => console.error('Failed to load drive folders', err));
  }, [user]);

  const handleSelectOfficialFolder = (folderId: string, folderPath: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderPath(folderPath);
    setDestinationMode('OFFICIAL');
  };

  const handleSelectPersonalFolder = (sub: PersonalSubfolder) => {
    setSelectedFolderId(sub.driveFolderId);
    setSelectedFolderPath(sub.path);
    setDestinationMode('PERSONAL');
  };

  const handleCreatePersonalSubfolder = async () => {
    if (!newSubfolderName.trim()) return;
    try {
      setIsCreatingSubfolder(true);
      const created = await api.addMyPersonalFolder(newSubfolderName.trim());
      setPersonalDrive(prev => {
        if (!prev) return null;
        return {
          ...prev,
          subfolders: [...prev.subfolders, created]
        };
      });
      // Auto-select newly created folder as upload target
      handleSelectPersonalFolder(created);
      setNewSubfolderName('');
    } catch (err: any) {
      alert(`Failed to create subfolder: ${err.message}`);
    } finally {
      setIsCreatingSubfolder(false);
    }
  };

  const handleRenamePersonalSubfolder = async (folderId: string) => {
    if (!editingSubfolderName.trim()) return;
    try {
      const updated = await api.renameMyPersonalFolder(folderId, editingSubfolderName.trim());
      setPersonalDrive(prev => {
        if (!prev) return null;
        return {
          ...prev,
          subfolders: prev.subfolders.map(s => s.driveFolderId === folderId ? updated : s)
        };
      });
      if (selectedFolderId === folderId) {
        setSelectedFolderPath(updated.path);
      }
      setEditingSubfolderId(null);
      setEditingSubfolderName('');
    } catch (err: any) {
      alert(`Failed to rename folder: ${err.message}`);
    }
  };

  const handleDeletePersonalSubfolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder from Google Drive?')) return;
    try {
      await api.deleteMyPersonalFolder(folderId);
      setPersonalDrive(prev => {
        if (!prev) return null;
        return {
          ...prev,
          subfolders: prev.subfolders.filter(s => s.driveFolderId !== folderId)
        };
      });
      if (selectedFolderId === folderId) {
        if (destinationFolderInfo?.driveFolderId) {
          setSelectedFolderId(destinationFolderInfo.driveFolderId);
          setSelectedFolderPath(destinationFolderInfo.fullPath);
          setDestinationMode('OFFICIAL');
        }
      }
    } catch (err: any) {
      alert(`Failed to delete folder: ${err.message}`);
    }
  };

  const handleToggleChecklist = async (itemId: string) => {
    if (!selectedAssignment) return;
    try {
      const updated = await api.toggleChecklistItem(selectedAssignment.id, itemId);
      setSelectedAssignment(prev => {
        if (!prev) return null;
        return {
          ...prev,
          checklist: prev.checklist.map(c => (c.id === itemId ? updated : c))
        };
      });
      api.getAssignments().then(setMyAssignments).catch(() => {});
    } catch (err) {
      console.error('Failed to toggle shot item', err);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Add files to queue immediately with status QUEUED (JIT optimization is applied during streaming)
  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
    const rawFiles = e.target.files ? Array.from(e.target.files) : [];
    if (rawFiles.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const newQueued: QueuedFile[] = rawFiles.map(file => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|mkv|avi|m4v)$/i.test(file.name);
      const isPhoto = file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|raw|cr2|nef|arw)$/i.test(file.name);
      const mediaType: MediaType = isVideo ? 'RAW_VIDEO' : isPhoto ? 'RAW_PHOTO' : 'OTHER';

      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        originalFile: file,
        originalSize: file.size,
        previewUrl: isPhoto && rawFiles.length <= 16 ? URL.createObjectURL(file) : undefined,
        mediaType,
        status: 'QUEUED',
        progress: 0
      };
    });

    setUploadFiles(prev => [...prev, ...newQueued]);
    setActiveTab('upload');
  };

  const handleRemoveQueuedFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSpeed = (bytesPerSec?: number): string => {
    if (!bytesPerSec || bytesPerSec === 0) return '';
    const mb = bytesPerSec / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB/s`;
    return `${Math.round(bytesPerSec / 1024)} KB/s`;
  };

  const formatEta = (seconds?: number): string => {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  // Upload single file directly to Google Drive in 8 MiB chunks with auto-retry & offset resumption
  const uploadSingleFileWithRetry = async (
    item: QueuedFile,
    assignment: Assignment,
    maxRetries = 2
  ): Promise<{ success: boolean; data?: any; error?: string }> => {
    let attempts = 0;
    while (attempts <= maxRetries) {
      try {
        // Just-In-Time Turbo Mode optimization right before streaming this specific file
        let fileToUpload = item.file;
        if (turboMode && item.mediaType === 'RAW_PHOTO' && !item.isOptimized) {
          setUploadFiles(prev =>
            prev.map(f => (f.id === item.id ? { ...f, status: 'OPTIMIZING' } : f))
          );
          try {
            const opt = await optimizeImageFile(item.file);
            fileToUpload = opt.file;
            item.file = opt.file;
            item.isOptimized = opt.isOptimized;
            item.reductionPercent = opt.reductionPercent;
          } catch (e) {
            console.warn('JIT optimization skipped, using original file:', e);
          }
        }

        setUploadFiles(prev =>
          prev.map(f => (f.id === item.id ? { ...f, status: 'UPLOADING', progress: 5 } : f))
        );

        const result = await uploadDirectToGoogleDrive({
          file: fileToUpload,
          assignmentId: assignment.id,
          eventId: assignment.event_id,
          mediaType: item.mediaType,
          targetFolderId: selectedFolderId || destinationFolderInfo?.driveFolderId,
          targetFolderPath: selectedFolderPath || destinationFolderInfo?.fullPath,
          description: `Uploaded for ${assignment.title}`,
          onProgress: (prog) => {
            setUploadFiles(prev =>
              prev.map(f =>
                f.id === item.id
                  ? {
                      ...f,
                      progress: prog.percentage,
                      loadedBytes: prog.loadedBytes,
                      totalBytes: prog.totalBytes,
                      speedBytesPerSec: prog.speedBytesPerSec,
                      etaSeconds: prog.etaSeconds
                    }
                  : f
              )
            );
          }
        });

        if (result.success) {
          return {
            success: true,
            data: {
              asset: result.asset,
              destination: result.destination || {
                driveFolderUrl: result.driveFolderUrl,
                driveFolderId: selectedFolderId || destinationFolderInfo?.driveFolderId
              }
            }
          };
        } else {
          throw new Error(result.error || 'Direct Drive upload failed');
        }
      } catch (err: any) {
        attempts++;
        if (attempts > maxRetries) {
          return { success: false, error: err.message || 'Upload failed after retries' };
        }
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    return { success: false, error: 'Upload failed' };
  };

  // High-Speed Concurrent Upload Pipeline (3 Parallel Streams)
  const handleStartUpload = async () => {
    if (!selectedAssignment || uploadFiles.length === 0) return;

    if (!driveStatus?.isConnected) {
      setUploadSummaryMessage('Error: Google Drive is not connected. Please connect Google Drive first.');
      return;
    }

    // Get all pending items (QUEUED or FAILED) from the live reference
    const currentList = uploadFilesRef.current.length > 0 ? uploadFilesRef.current : uploadFiles;
    const pendingList = currentList.filter(f => f.status === 'QUEUED' || f.status === 'FAILED');

    if (pendingList.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadSummaryMessage('');

    let queueIndex = 0;
    let completedCount = 0;
    let failedCount = 0;
    const concurrency = Math.min(3, pendingList.length); // 3 files uploading in parallel for max throughput

    const worker = async () => {
      while (true) {
        let itemIndex = -1;
        if (queueIndex < pendingList.length) {
          itemIndex = queueIndex++;
        } else {
          break; // Entire 100+ file queue finished!
        }

        const item = pendingList[itemIndex];
        if (!item) break;

        const res = await uploadSingleFileWithRetry(item, selectedAssignment);

        if (res.success && res.data) {
          completedCount++;
          setUploadFiles(prev =>
            prev.map(f =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'COMPLETED',
                    progress: 100,
                    driveWebUrl: res.data.asset?.drive_web_url,
                    driveFolderUrl: res.data.destination?.driveFolderUrl
                  }
                : f
            )
          );
        } else {
          failedCount++;
          setUploadFiles(prev =>
            prev.map(f =>
              f.id === item.id
                ? {
                    ...f,
                    status: 'FAILED',
                    error: res.error || 'Upload failed'
                  }
                : f
            )
          );
        }
      }
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    setIsUploading(false);

    const folderTargetDisplay = selectedFolderPath || destinationFolderInfo?.fullPath || 'SAVISKAR 2026';
    if (completedCount > 0) {
      setUploadSummaryMessage(
        failedCount === 0
          ? `✓ Successfully uploaded all ${completedCount} file(s) into Google Drive folder "${folderTargetDisplay}".`
          : `✓ Uploaded ${completedCount} file(s) into Google Drive folder "${folderTargetDisplay}" (${failedCount} failed - tap "Upload All" to retry failed).`
      );
      api.getMediaAssets({ assignment_id: selectedAssignment.id }).then(setAssignedMedia).catch(() => {});
      api.getAssignment(selectedAssignment.id).then(setSelectedAssignment).catch(() => {});
    } else if (failedCount > 0) {
      setUploadSummaryMessage(`Upload failed for ${failedCount} file(s). Please verify network and Google Drive connection.`);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected({ target: { files: Array.from(e.dataTransfer.files) } });
    }
  };

  // Calculate totals for optimization metrics
  const totalOriginalBytes = uploadFiles.reduce((acc, f) => acc + f.originalSize, 0);
  const totalUploadBytes = uploadFiles.reduce((acc, f) => acc + f.file.size, 0);
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalUploadBytes);
  const totalSavedMB = (totalSavedBytes / (1024 * 1024)).toFixed(1);

  const totalQueueBytes = uploadFiles.reduce((acc, f) => acc + f.file.size, 0);
  const totalQueueLoadedBytes = uploadFiles.reduce((acc, f) => {
    if (f.status === 'COMPLETED') return acc + f.file.size;
    return acc + (f.loadedBytes || 0);
  }, 0);
  const overallQueuePercent = totalQueueBytes > 0 ? Math.min(100, Math.round((totalQueueLoadedBytes / totalQueueBytes) * 100)) : 0;
  const activeSpeed = uploadFiles.find(f => f.status === 'UPLOADING' && f.speedBytesPerSec)?.speedBytesPerSec;

  const pendingCount = uploadFiles.filter(f => f.status === 'QUEUED' || f.status === 'FAILED').length;
  const completedCount = uploadFiles.filter(f => f.status === 'COMPLETED').length;

  const completedShotsCount = selectedAssignment?.checklist?.filter(c => c.is_completed).length || 0;
  const totalShotsCount = selectedAssignment?.checklist?.length || 0;
  const checklistProgressPercent = totalShotsCount > 0 ? Math.round((completedShotsCount / totalShotsCount) * 100) : 0;

  // Filtered task list including role station
  const filteredAssignments = myAssignments.filter(a => {
    if (dayFilter === 'DAY_1' && !/day\s*1/i.test(a.day_session)) return false;
    if (dayFilter === 'DAY_2' && !/day\s*2/i.test(a.day_session)) return false;
    if (roleMediaFilter === 'PHOTO' && a.coverage_type !== 'PHOTOGRAPHY' && a.coverage_type !== 'HYBRID') return false;
    if (roleMediaFilter === 'VIDEO' && a.coverage_type !== 'VIDEOGRAPHY' && a.coverage_type !== 'HYBRID') return false;
    return true;
  });

  const acceptedFileExtensions =
    roleMediaFilter === 'PHOTO'
      ? 'image/*,.cr2,.cr3,.nef,.arw,.dng,.raw,.heic,.raf'
      : roleMediaFilter === 'VIDEO'
      ? 'video/*,audio/*,.mp4,.mov,.mkv,.prores,.wav,.aac,.m4a'
      : 'image/*,video/*,audio/*,.cr2,.cr3,.nef,.arw,.dng,.raw,.heic,.raf,.mp4,.mov,.wav';

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              SAVISKAR 2026 Media Ops
            </span>
            <span className="text-xs text-slate-500 font-medium">• Field Crew Rapid Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Fast Camera Upload & Shotlist
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            1-Click upload for camera crew. Photos & 4K footage automatically stream into the official Google Drive folders.
          </p>
        </div>

        {/* Live Google Drive Status Badge */}
        <div className="flex items-center gap-3">
          {driveStatus?.isConnected ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200/90 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-emerald-800">Drive Sync Active</span>
              <span className="text-[10px] text-emerald-600 hidden md:inline font-mono">
                ({driveStatus.userEmail || 'rikhiritik8@gmail.com'})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Drive Sync Offline</span>
            </div>
          )}
        </div>
      </div>

      {/* Role-Specific Media Station Switcher */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Media Filter Station
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Only shows uploads and folders matching your role.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            onClick={() => setRoleMediaFilter('PHOTO')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              roleMediaFilter === 'PHOTO'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>📸 Photos & RAWs</span>
          </button>

          <button
            onClick={() => setRoleMediaFilter('VIDEO')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              roleMediaFilter === 'VIDEO'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>🎥 4K Video Footage</span>
          </button>

          <button
            onClick={() => setRoleMediaFilter('ALL')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${
              roleMediaFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <span>All Formats</span>
          </button>
        </div>
      </div>

      {/* Auth Success Toast */}
      {authSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">Google Drive Connected Successfully! Files will stream directly into official folders.</span>
          </div>
          <button
            onClick={() => setAuthSuccessBanner(false)}
            className="text-xs font-semibold text-emerald-800 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Two-Column Workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tasks / Assignments List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Coverage Tasks ({filteredAssignments.length})
            </h2>

            {/* Quick Day Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
              <button
                onClick={() => setDayFilter('ALL')}
                className={`px-2 py-0.5 rounded-lg transition-colors ${
                  dayFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDayFilter('DAY_1')}
                className={`px-2 py-0.5 rounded-lg transition-colors ${
                  dayFilter === 'DAY_1' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Day 1
              </button>
              <button
                onClick={() => setDayFilter('DAY_2')}
                className={`px-2 py-0.5 rounded-lg transition-colors ${
                  dayFilter === 'DAY_2' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Day 2
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-600" />
              Loading tasks...
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-500">
              No tasks found for this filter.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {filteredAssignments.map(a => {
                const isSelected = selectedAssignment?.id === a.id;
                return (
                  <div
                    key={a.id}
                    onClick={() => selectAssignment(a.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50/60 border-red-500 shadow-xs ring-1 ring-red-500'
                        : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <PriorityBadge priority={a.priority} />
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {a.coverage_type}
                        </span>
                        <StatusBadge status={a.status} size="sm" />
                      </div>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{a.title}</h3>
                    <div className="mt-2 text-xs text-slate-500 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{a.location_name || 'Main Campus'}</span>
                      </span>
                      <span className="font-semibold text-slate-700 shrink-0 font-mono text-[11px]">
                        {a.day_session}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Unified Active Task Hub (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedAssignment ? (
            <>
              {/* Active Task Banner Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <PriorityBadge priority={selectedAssignment.priority} />
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider">
                        {selectedAssignment.coverage_type}
                      </span>
                      <span className="text-xs text-slate-500 font-mono font-semibold">
                        {selectedAssignment.day_session}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedAssignment.title}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      📍 {selectedAssignment.location_name} • Deliverable: <span className="font-semibold text-slate-800">{selectedAssignment.expected_deliverable}</span>
                    </p>
                  </div>

                  {destinationFolderInfo?.driveFolderUrl && (
                    <a
                      href={destinationFolderInfo.driveFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 self-start sm:self-auto shrink-0 transition-colors"
                      title="Open destination in Google Drive"
                    >
                      <FolderOpen className="w-4 h-4 text-amber-500" />
                      <span>Open Drive Folder</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}
                </div>

                {/* Tab Navigation: Upload, Checklist, Media */}
                <div className="flex items-center gap-2 border-b border-slate-200 pt-1">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                      activeTab === 'upload'
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Fast Upload</span>
                    {uploadFiles.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                        {uploadFiles.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveTab('checklist')}
                    className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                      activeTab === 'checklist'
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Shot Checklist ({completedShotsCount}/{totalShotsCount})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('media')}
                    className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
                      activeTab === 'media'
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Uploaded Media ({assignedMedia.length})</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: FAST IN-PAGE UPLOAD DROPZONE */}
              {activeTab === 'upload' && (
                <div className="space-y-4">
                  {/* Turbo Event Mode Toggle */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        turboMode ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Zap className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">Turbo Upload Mode</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            turboMode
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {turboMode ? 'Active (Fast)' : 'Off (Full Size)'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {turboMode
                            ? 'Auto-compresses high-res photos on device for rapid uploads on event Wi-Fi.'
                            : 'Uploads full-size original files byte-for-byte without compression.'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setTurboMode(!turboMode)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 self-start sm:self-auto border ${
                        turboMode
                          ? 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>{turboMode ? 'Disable Turbo Mode' : 'Enable Turbo Mode'}</span>
                    </button>
                  </div>

                  {/* CLEAN RED & WHITE GOOGLE DRIVE DESTINATION CARD */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Google Drive Target
                        </span>
                        {destinationMode === 'PERSONAL' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                            Personal Drive
                          </span>
                        )}
                      </div>

                      {/* Folder Path Display */}
                      <div className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-slate-900 truncate">
                        <FolderOpen className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="truncate">
                          {selectedFolderPath || destinationFolderInfo?.fullPath || 'SAVISKAR 2026 / Photography'}
                        </span>
                      </div>

                      {personalDrive?.sharedWithEmail && (
                        <p className="text-xs text-slate-500">
                          Shared with: <strong className="text-slate-800">{personalDrive.sharedWithEmail}</strong>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                      {/* Super Admin Console Shortcut */}
                      <Link
                        to="/drive"
                        className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-colors flex items-center gap-1.5"
                        title="Manage Member Gmail Drives & Transfer Data"
                      >
                        <HardDrive className="w-4 h-4 text-red-500" />
                        <span>Drives & Transfer Studio &rarr;</span>
                      </Link>

                      {/* Open in Drive button */}
                      {(selectedFolderId || destinationFolderInfo?.driveFolderId) && (
                        <a
                          href={`https://drive.google.com/drive/folders/${selectedFolderId || destinationFolderInfo?.driveFolderId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors flex items-center gap-1.5"
                          title="Open this folder in Google Drive"
                        >
                          <span>Open in Drive</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        </a>
                      )}

                      {/* Browse Tree / Setup Personal Drive button */}
                      <button
                        onClick={() => setShowPersonalDriveDrawer(!showPersonalDriveDrawer)}
                        className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-colors flex items-center gap-1.5"
                      >
                        <FolderPlus className="w-4 h-4" />
                        <span>{showPersonalDriveDrawer ? 'Hide Folder Tree' : 'Show Folder Tree'}</span>
                      </button>
                    </div>
                  </div>

                  {/* UNIFIED INTERACTIVE GOOGLE DRIVE FOLDER TREE */}
                  {showPersonalDriveDrawer && (
                    <InteractiveFolderTree
                      selectedFolderId={selectedFolderId}
                      selectedFolderPath={selectedFolderPath}
                      onSelectFolder={(folderId, folderPath, mode) => {
                        setSelectedFolderId(folderId);
                        setSelectedFolderPath(folderPath);
                        setDestinationMode(mode);
                      }}
                      currentUser={user}
                      activeRole={activeRole}
                      onClose={() => setShowPersonalDriveDrawer(false)}
                    />
                  )}

                  {/* Drag & Drop Upload Card */}
                  <div
                    ref={dropzoneRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 sm:p-10 border-2 border-dashed border-red-300 hover:border-red-600 bg-red-50/20 hover:bg-red-50/40 rounded-2xl text-center cursor-pointer transition-all group shadow-xs"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={acceptedFileExtensions}
                      onChange={handleFilesSelected}
                      className="hidden"
                    />

                    <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      {roleMediaFilter === 'PHOTO' ? (
                        <Camera className="w-7 h-7" />
                      ) : roleMediaFilter === 'VIDEO' ? (
                        <Film className="w-7 h-7" />
                      ) : (
                        <UploadCloud className="w-7 h-7" />
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                      {roleMediaFilter === 'PHOTO'
                        ? 'Drop DSLR Photos or RAWs Here'
                        : roleMediaFilter === 'VIDEO'
                        ? 'Drop 4K Video Clips or Soundboard WAV Stems Here'
                        : 'Drop Photos or 4K Video Clips Here'}
                    </h3>

                    {/* TARGET FOLDER PROMINENT BADGE */}
                    <div className="my-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100/90 text-red-900 text-xs font-bold border border-red-200/80 shadow-2xs">
                      <FolderOpen className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>Target: <strong className="underline decoration-red-400">{selectedFolderPath || destinationFolderInfo?.fullPath || 'SAVISKAR 2026'}</strong> on Google Drive</span>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      {roleMediaFilter === 'PHOTO'
                        ? 'Tap or drag camera files from your SD card. Supports Canon CR2/CR3, Nikon NEF, Sony ARW, DNG, and JPEG.'
                        : roleMediaFilter === 'VIDEO'
                        ? 'Tap or drag high-bitrate footage. Supports 4K MP4, MOV, ProRes, and Zoom H6 WAV audio stems.'
                        : 'Tap or drag camera files from your SD card or phone. Supports JPEG, PNG, RAW, MP4, and MOV files.'}
                    </p>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      <span className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 group-hover:bg-red-700 text-white shadow-xs transition-colors">
                        {roleMediaFilter === 'PHOTO'
                          ? 'Select Photo Files'
                          : roleMediaFilter === 'VIDEO'
                          ? 'Select Video & Audio Files'
                          : 'Choose Files from Device'}
                      </span>
                    </div>
                  </div>

                  {/* Summary / Success Message */}
                  {uploadSummaryMessage && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{uploadSummaryMessage}</span>
                      </div>
                      {destinationFolderInfo?.driveFolderUrl && (
                        <a
                          href={destinationFolderInfo.driveFolderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-emerald-900 underline shrink-0 hover:text-emerald-700"
                        >
                          View in Google Drive ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* Queued Files Worklist */}
                  {uploadFiles.length > 0 && (
                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              Selected Files ({uploadFiles.length})
                            </h4>
                            {isUploading && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 animate-pulse">
                                Direct Drive Streaming (3x Parallel)
                              </span>
                            )}
                            {totalSavedBytes > 0 && !isUploading && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Saved {totalSavedMB} MB with Turbo ⚡
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Queue: <strong className="text-slate-800">{completedCount}/{uploadFiles.length} files</strong> ({formatFileSize(totalQueueLoadedBytes)} of {formatFileSize(totalQueueBytes)})
                            {activeSpeed && activeSpeed > 0 ? ` • ${formatSpeed(activeSpeed)}` : ''}
                          </p>
                          {isUploading && (
                            <div className="mt-2 max-w-md w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                              <div
                                className="bg-red-600 h-2 rounded-full transition-all duration-200"
                                style={{ width: `${overallQueuePercent}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <button
                            onClick={() => setUploadFiles([])}
                            disabled={isUploading}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                          >
                            Clear
                          </button>

                          <button
                            onClick={handleStartUpload}
                            disabled={isUploading || pendingCount === 0}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors"
                          >
                            {isUploading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Uploading 3 at a time...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4 fill-current" />
                                <span>Upload All ({pendingCount} Files)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* File Items Grid */}
                      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                        {uploadFiles.map(item => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                              item.status === 'COMPLETED'
                                ? 'bg-emerald-50/50 border-emerald-200'
                                : item.status === 'UPLOADING'
                                ? 'bg-red-50/40 border-red-200 shadow-2xs'
                                : 'bg-white border-slate-200/90'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {item.previewUrl ? (
                                  <img
                                    src={item.previewUrl}
                                    alt={item.file.name}
                                    className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                    {item.mediaType.includes('VIDEO') ? <Film className="w-5 h-5 text-red-500" /> : <Camera className="w-5 h-5" />}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                                    {item.file.name}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                    <span>{formatFileSize(item.file.size)}</span>
                                    {item.isOptimized && (
                                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                                        -{item.reductionPercent}% optimized ⚡
                                      </span>
                                    )}
                                    <span>• {item.mediaType}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {item.status === 'COMPLETED' ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                      <CheckCircle className="w-4 h-4 text-emerald-600" /> Synced
                                    </span>
                                    {item.driveWebUrl && (
                                      <a
                                        href={item.driveWebUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-0.5"
                                      >
                                        <span>Drive</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                ) : item.status === 'UPLOADING' ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      <span>{item.progress}%</span>
                                      {item.speedBytesPerSec && item.speedBytesPerSec > 0 && (
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                          {formatSpeed(item.speedBytesPerSec)}
                                        </span>
                                      )}
                                    </div>
                                    {item.loadedBytes !== undefined && (
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        {formatFileSize(item.loadedBytes)} / {formatFileSize(item.totalBytes || item.file.size)}
                                      </span>
                                    )}
                                  </div>
                                ) : item.status === 'FAILED' ? (
                                  <span className="text-xs font-bold text-red-600 flex items-center gap-1" title={item.error}>
                                    <AlertCircle className="w-4 h-4" /> Failed
                                  </span>
                                ) : item.status === 'OPTIMIZING' ? (
                                  <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Compressing...
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleRemoveQueuedFile(item.id)}
                                    disabled={isUploading}
                                    className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Live Progress Bar */}
                            {item.status === 'UPLOADING' && (
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-red-600 h-1.5 rounded-full transition-all duration-150"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SHOT CHECKLIST */}
              {activeTab === 'checklist' && (
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Operational Shot Checklist ({completedShotsCount}/{totalShotsCount})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tap any shot item to mark it completed as you capture it on field.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-900">{checklistProgressPercent}% Complete</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${checklistProgressPercent}%` }}
                    />
                  </div>

                  {selectedAssignment.checklist && selectedAssignment.checklist.length > 0 ? (
                    <div className="space-y-2 pt-2">
                      {selectedAssignment.checklist.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleToggleChecklist(item.id)}
                          className={`p-3.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                            item.is_completed
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-700'
                              : 'bg-white border-slate-200/90 hover:border-slate-300 text-slate-900'
                          }`}
                        >
                          {item.is_completed ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 shrink-0 hover:text-slate-500" />
                          )}
                          <span className={`text-xs font-semibold ${item.is_completed ? 'line-through text-slate-400' : ''}`}>
                            {item.shot_title}
                          </span>
                          {item.is_required && (
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              Mandatory
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      No specific shot items recorded for this assignment.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: UPLOADED MEDIA FEED */}
              {activeTab === 'media' && (
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Backed Up Media for this Task ({assignedMedia.length})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Files safely backed up into Google Drive.
                      </p>
                    </div>

                    {destinationFolderInfo?.driveFolderUrl && (
                      <a
                        href={destinationFolderInfo.driveFolderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline"
                      >
                        <span>Open Drive Folder</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {assignedMedia.length === 0 ? (
                    <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      No media uploaded yet for this assignment. Use the Fast Upload tab to stream footage!
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {assignedMedia.map(m => (
                        <div
                          key={m.id}
                          className="group relative rounded-xl border border-slate-200/90 overflow-hidden bg-white shadow-2xs hover:shadow-xs transition-all"
                        >
                          <div className="aspect-square bg-slate-100 overflow-hidden flex items-center justify-center">
                            {m.media_type.includes('VIDEO') ? (
                              <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                                <Film className="w-8 h-8 text-red-500" />
                                <span className="text-[10px] font-bold uppercase">4K Video</span>
                              </div>
                            ) : (
                              <img
                                src={m.drive_thumbnail_url || 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=300'}
                                alt={m.filename}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            )}
                          </div>

                          <div className="p-2.5 space-y-1">
                            <p className="text-[11px] font-bold text-slate-900 truncate" title={m.filename}>
                              {m.filename}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                              {formatFileSize(m.file_size_bytes)} • By {m.uploader_name}
                            </p>
                            <a
                              href={m.drive_web_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold text-red-600 hover:underline inline-flex items-center gap-1 pt-1"
                            >
                              <span>View in Drive</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs">
              Select an assignment on the left to start uploading and viewing checklists.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
