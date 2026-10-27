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
  Upload,
  X,
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
  Plus,
  Pause,
  Play,
  StopCircle,
  XCircle
} from 'lucide-react';

interface QueuedFile {
  id: string;
  file: File;
  originalFile: File;
  originalSize: number;
  previewUrl?: string;
  mediaType: MediaType;
  status: 'QUEUED' | 'OPTIMIZING' | 'UPLOADING' | 'VERIFYING' | 'REGISTERING' | 'COMPLETED' | 'FAILED' | 'REGISTRATION_FAILED';
  progress: number;
  loadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  error?: string;
  driveFileId?: string;
  uploadUrl?: string;
  driveWebUrl?: string;
  driveFolderUrl?: string;
  isOptimized?: boolean;
  reductionPercent?: number;
  attemptCount?: number;
  errorStage?: 'SESSION' | 'UPLOAD' | 'REGISTER';
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

  // Turbo Event Compression Mode (Off by default for lossless 100% RAW/4K quality)
  const [turboMode, setTurboMode] = useState<boolean>(false);

  // Direct PC Upload State (Identical to Super Admin Drive Studio method)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);
  const [currentFileProgress, setCurrentFileProgress] = useState<number>(0);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [successResults, setSuccessResults] = useState<Array<{ name: string; url: string; folder: string }>>([]);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>('');

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
  const isCancelledRef = useRef<boolean>(false);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAssignments({ my_assignments: true });
      const list = data.length > 0 ? data : await api.getAssignments();
      setMyAssignments(list);

      if (list.length > 0 && !selectedAssignment) {
        // Intelligently select first matching assignment according to user's active role
        const targetCoverage = (activeRole === 'VIDEOGRAPHER' || isVideographer || roleMediaFilter === 'VIDEO')
          ? 'VIDEOGRAPHY'
          : 'PHOTOGRAPHY';
        const matching = list.find(a => a.coverage_type === targetCoverage || a.coverage_type === 'HYBRID') || list[0];
        await selectAssignment(matching.id);
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

  // File selection (identical to Super Admin Drive Studio Direct PC Upload)
  const handleFilesSelected = (input: FileList | File[] | React.ChangeEvent<HTMLInputElement> | null) => {
    let files: File[] = [];
    if (!input) return;
    if ('target' in input && input.target) {
      files = input.target.files ? Array.from(input.target.files) : [];
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else if (input instanceof FileList || Array.isArray(input)) {
      files = Array.from(input);
    }
    if (files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);
    setSuccessResults([]);
    setUploadErrorMessage('');
    setActiveTab('upload');
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setSuccessResults([]);
    setUploadErrorMessage('');
    setCurrentFileIndex(0);
    setCurrentFileProgress(0);
    setOverallProgress(0);
  };

  // Direct PC Upload Execution (Identical to Super Admin Drive Studio method)
  const handleExecuteUpload = async () => {
    if (selectedFiles.length === 0) return;

    if (!driveStatus?.isConnected) {
      setUploadErrorMessage('Google Drive is offline. Please check connection in Drive Studio.');
      return;
    }

    // Determine target folder destination
    const targetFolderId = selectedFolderId || destinationFolderInfo?.driveFolderId;
    const targetFolderPath = selectedFolderPath || destinationFolderInfo?.fullPath || 'SAVISKAR 2026';

    // Intelligently fallback assignment if none is selected
    let activeAssignment: Assignment = selectedAssignment!;
    if (!activeAssignment) {
      const targetCoverage = (activeRole === 'VIDEOGRAPHER' || isVideographer || roleMediaFilter === 'VIDEO')
        ? 'VIDEOGRAPHY'
        : 'PHOTOGRAPHY';
      activeAssignment = myAssignments.find(a => a.coverage_type === targetCoverage || a.coverage_type === 'HYBRID') || myAssignments[0];
    }
    if (!activeAssignment) {
      activeAssignment = {
        id: 'general-field-upload',
        event_id: 'event-saviskar-2026',
        title: (activeRole === 'VIDEOGRAPHER' || roleMediaFilter === 'VIDEO') ? 'General Video Coverage' : 'General Photo Coverage',
        notes: 'Auto-provisioned field coverage upload',
        coverage_type: (activeRole === 'VIDEOGRAPHER' || roleMediaFilter === 'VIDEO') ? 'VIDEOGRAPHY' : 'PHOTOGRAPHY',
        priority: 'MEDIUM',
        status: 'CAPTURING',
        day_session: 'DAY_1',
        location_name: 'Main Campus',
        start_time: new Date().toISOString(),
        deadline: new Date().toISOString(),
        created_by: 'system',
        expected_deliverable: 'Event Media',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    try {
      setIsUploading(true);
      isCancelledRef.current = false;
      setCurrentFileIndex(0);
      setCurrentFileProgress(0);
      setOverallProgress(0);
      setSuccessResults([]);
      setUploadErrorMessage('');

      const uploadedResults: Array<{ name: string; url: string; folder: string }> = [];
      const failedResults: Array<{ name: string; error: string }> = [];
      const totalFiles = selectedFiles.length;

      for (let i = 0; i < totalFiles; i++) {
        if (isCancelledRef.current) {
          console.log('[Upload] Sequential batch cancelled by user.');
          break;
        }

        setCurrentFileIndex(i);
        setCurrentFileProgress(0);
        const currentFile = selectedFiles[i];

        // Determine media type according to user's station / file extension
        const isVideo = currentFile.type.startsWith('video/') || /\.(mp4|mov|mkv|avi|m4v|prores)$/i.test(currentFile.name);
        const isAudio = currentFile.type.startsWith('audio/') || /\.(wav|mp3|aac|m4a)$/i.test(currentFile.name);
        const isPhoto = currentFile.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|raw|cr2|cr3|nef|arw|dng)$/i.test(currentFile.name);

        let mediaType: MediaType = 'RAW_PHOTO';
        if (roleMediaFilter === 'VIDEO' || isVideo) {
          mediaType = 'RAW_VIDEO';
        } else if (isPhoto) {
          mediaType = 'RAW_PHOTO';
        } else if (isAudio) {
          mediaType = 'OTHER';
        }

        let fileToSend = currentFile;
        if (turboMode && isPhoto) {
          try {
            const opt = await optimizeImageFile(currentFile);
            if (opt?.file) fileToSend = opt.file;
          } catch {}
        }

        const formData = new FormData();
        formData.append('file', fileToSend);
        if (targetFolderId) formData.append('target_folder_id', targetFolderId);
        formData.append('target_folder_path', targetFolderPath);
        formData.append('media_type', mediaType);
        if (activeAssignment?.id) formData.append('assignment_id', activeAssignment.id);
        if (activeAssignment?.event_id) formData.append('event_id', activeAssignment.event_id);
        formData.append('description', `Uploaded by field crew for ${activeAssignment?.title || 'SAVISKAR 2026'}`);

        try {
          const res = await api.uploadMediaFile(formData, (percent) => {
            setCurrentFileProgress(percent);
            const overall = Math.round(((i + (percent / 100)) / totalFiles) * 100);
            setOverallProgress(overall);
          });

          uploadedResults.push({
            name: currentFile.name,
            url: res.asset?.drive_web_url || '',
            folder: targetFolderPath
          });
          setSuccessResults([...uploadedResults]);
        } catch (fileErr: any) {
          console.warn(`[Upload Error] File "${currentFile.name}" failed:`, fileErr);
          failedResults.push({
            name: currentFile.name,
            error: fileErr.message || 'Network error'
          });
        }
      }

      setOverallProgress(100);
      setSuccessResults(uploadedResults);

      if (failedResults.length > 0) {
        // Keep only failed files in selection so user can re-trigger easily
        const failedNames = new Set(failedResults.map(f => f.name));
        setSelectedFiles(prev => prev.filter(f => failedNames.has(f.name)));
        setUploadErrorMessage(
          `${failedResults.length} of ${totalFiles} file(s) had network interruptions. ${uploadedResults.length} succeeded. You can click Start Upload to retry remaining files.`
        );
      } else {
        setSelectedFiles([]);
        setUploadErrorMessage('');
      }

      // Refresh media feed
      if (activeAssignment?.id && activeAssignment.id !== 'general-field-upload' && uploadedResults.length > 0) {
        api.getMediaAssets({ assignment_id: activeAssignment.id }).then(setAssignedMedia).catch(() => {});
        api.getAssignment(activeAssignment.id).then(setSelectedAssignment).catch(() => {});
      }
    } catch (err: any) {
      console.error('[Upload Error]', err);
      setUploadErrorMessage(err.message || 'Error uploading file to Google Drive. Please retry.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    isCancelledRef.current = true;
    setIsUploading(false);
    setUploadErrorMessage('Upload stopped. Files already transferred remain safely in Google Drive.');
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
      handleFilesSelected(e.dataTransfer.files);
    }
  };

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
                    {selectedFiles.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                        {selectedFiles.length}
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

                  {/* Selected Files List (Identical to Super Admin Drive Studio Direct PC Upload) */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">
                          {selectedFiles.length} files selected ({formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))})
                        </span>
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={handleClearAll}
                          className="text-xs text-rose-600 hover:underline font-bold disabled:opacity-50 cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                        {selectedFiles.map((file, idx) => (
                          <div key={`${file.name}-${idx}`} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs">
                            <span className="font-bold text-slate-800 truncate mr-2">{file.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(file.size)})</span>
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => handleRemoveFile(idx)}
                                className="text-slate-400 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar (Identical to Super Admin Drive Studio) */}
                  {isUploading && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-red-950">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-red-600" />
                          <span>File {currentFileIndex + 1} of {selectedFiles.length} ({currentFileProgress}%)</span>
                        </span>
                        <span>{overallProgress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-red-200 overflow-hidden">
                        <div
                          className="h-full bg-red-600 transition-all duration-200"
                          style={{ width: `${overallProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] text-red-700 font-mono truncate max-w-xs sm:max-w-md">
                          {selectedFiles[currentFileIndex]?.name}
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelUpload}
                          className="text-xs font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                        >
                          Cancel Upload
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Success Banner (Identical to Super Admin Drive Studio) */}
                  {successResults.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>Uploaded {successResults.length} files successfully!</span>
                        </span>
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {successResults.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="font-bold text-slate-800 truncate mr-2">✓ {r.name}</span>
                            {r.url && (
                              <a href={r.url} target="_blank" rel="noreferrer" className="text-red-600 hover:underline font-bold inline-flex items-center gap-1 shrink-0">
                                <span>Drive</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error Notification */}
                  {uploadErrorMessage && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Error: </span>
                          <span>{uploadErrorMessage}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadErrorMessage('')}
                        className="text-red-500 hover:text-red-800 font-bold shrink-0 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedFiles.length > 0 && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={isUploading}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        Clear All
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteUpload}
                        disabled={isUploading || selectedFiles.length === 0}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading to Drive ({currentFileIndex + 1}/{selectedFiles.length})...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Start Upload ({selectedFiles.length} Files)</span>
                          </>
                        )}
                      </button>
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
