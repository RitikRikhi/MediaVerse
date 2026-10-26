import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Assignment, ShotChecklistItem, MediaType, MediaAsset } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { Modal } from '../components/ui/Modal';
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
  AlertTriangle
} from 'lucide-react';

interface QueuedFile {
  id: string;
  file: File;
  previewUrl?: string;
  mediaType: MediaType;
  status: 'QUEUED' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  progress: number;
  error?: string;
  driveWebUrl?: string;
  driveFolderUrl?: string;
}

export const FieldCrewPortalPage: React.FC = () => {
  const { user, setShowAuthModal } = useAuth();
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { checklist: ShotChecklistItem[] }) | null>(null);
  const [assignedMedia, setAssignedMedia] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSummaryMessage, setUploadSummaryMessage] = useState('');
  const [destinationFolderInfo, setDestinationFolderInfo] = useState<any>(null);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('');
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [authSuccessBanner, setAuthSuccessBanner] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Match corresponding folder in drive folder hierarchy
      if (driveFolders.length > 0) {
        const isDay2 = detail.day_session && /day\s*2/i.test(detail.day_session);
        const dayStr = isDay2 ? 'Day 2' : 'Day 1';
        const catStr = detail.coverage_type === 'VIDEOGRAPHY' ? 'Raw Videography' : 'Photography';
        const match = driveFolders.find(f => f.path.includes(dayStr) && f.path.includes(catStr));
        if (match) {
          setSelectedFolderPath(match.path);
          if (match.driveFolderId) setSelectedFolderId(match.driveFolderId);
        }
      }
    } catch (err) {
      console.error('Failed to select assignment', err);
    }
  };

  useEffect(() => {
    loadAssignments();

    // Check if returning from Google OAuth redirect
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

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const newQueue: QueuedFile[] = files.map(file => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|mkv|avi|m4v)$/i.test(file.name);
      const isPhoto = file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|raw|cr2|nef|arw)$/i.test(file.name);
      const mediaType: MediaType = isVideo ? 'RAW_VIDEO' : isPhoto ? 'RAW_PHOTO' : 'OTHER';

      let previewUrl: string | undefined;
      if (isPhoto) {
        previewUrl = URL.createObjectURL(file);
      }

      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        previewUrl,
        mediaType,
        status: 'QUEUED',
        progress: 0
      };
    });

    setUploadFiles(prev => [...prev, ...newQueue]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveQueuedFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleStartUpload = async () => {
    if (!selectedAssignment || uploadFiles.length === 0) return;

    if (!driveStatus?.isConnected) {
      setUploadSummaryMessage('Error: Google Drive is not connected. Please connect Google Drive first.');
      return;
    }

    setIsUploading(true);
    setUploadSummaryMessage('');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < uploadFiles.length; i++) {
      const item = uploadFiles[i];
      if (item.status === 'COMPLETED') continue;

      setUploadFiles(prev =>
        prev.map(f => (f.id === item.id ? { ...f, status: 'UPLOADING', progress: 10 } : f))
      );

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('assignment_id', selectedAssignment.id);
        formData.append('event_id', selectedAssignment.event_id);
        formData.append('media_type', item.mediaType);
        formData.append('description', `Uploaded for ${selectedAssignment.title}`);
        formData.append('target_folder_id', selectedFolderId || '');
        formData.append('target_folder_path', selectedFolderPath || '');

        const result = await api.uploadMediaFile(formData, percent => {
          setUploadFiles(prev =>
            prev.map(f => (f.id === item.id ? { ...f, progress: percent } : f))
          );
        });

        setUploadFiles(prev =>
          prev.map(f =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'COMPLETED',
                  progress: 100,
                  driveWebUrl: result.asset.drive_web_url,
                  driveFolderUrl: result.destination?.driveFolderUrl
                }
              : f
          )
        );
        successCount++;
      } catch (err: any) {
        failCount++;
        const errMsg = err.message || 'Upload failed';
        if (errMsg.includes('GOOGLE_DRIVE_NOT_CONNECTED') || errMsg.includes('not connected')) {
          setDriveStatus((prev: any) => ({ ...prev, isConnected: false }));
        }
        setUploadFiles(prev =>
          prev.map(f =>
            f.id === item.id
              ? {
                  ...f,
                  status: 'FAILED',
                  error: errMsg
                }
              : f
          )
        );
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      const folderTargetDisplay = selectedFolderPath || destinationFolderInfo?.fullPath || 'SAVISKAR 2026';
      setUploadSummaryMessage(
        `Successfully uploaded and registered ${successCount} file(s) into Google Drive folder "${folderTargetDisplay}".`
      );
      const updatedMedia = await api.getMediaAssets({ assignment_id: selectedAssignment.id });
      setAssignedMedia(updatedMedia);
      const updatedAssignment = await api.getAssignment(selectedAssignment.id);
      setSelectedAssignment(updatedAssignment);
    }
  };

  const completedShotsCount = selectedAssignment?.checklist?.filter(c => c.is_completed).length || 0;
  const totalShotsCount = selectedAssignment?.checklist?.length || 0;
  const checklistProgressPercent = totalShotsCount > 0 ? Math.round((completedShotsCount / totalShotsCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Field Crew & Camera Operators
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026 Production</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Media Upload & Field Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Check off required shots and upload raw photos & 4K video clips directly to the official Google Drive folders.
          </p>
        </div>

        <button
          onClick={() => {
            if (!user) {
              setShowAuthModal(true);
              return;
            }
            setUploadSummaryMessage('');
            if (!selectedAssignment && myAssignments.length > 0) {
              selectAssignment(myAssignments[0].id);
            }
            setShowUploadModal(true);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors self-start sm:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Media to Drive</span>
        </button>
      </div>

      {/* Active Crew Identity & Upload Authentication Card */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
        user ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/80 border-amber-300'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
            user ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            {user ? (user.full_name?.charAt(0) || 'C') : '?'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {user ? `Uploading as: ${user.full_name}` : 'Not Signed In (Guest / Dev Mode)'}
              </span>
              {user?.roles?.[0] && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 uppercase tracking-wider">
                  {user.roles[0]}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {user
                ? `All media you upload will be permanently credited to "${user.full_name}" in database audit trails and uploaded to official Google Drive folders.`
                : 'Sign in with your crew account so your photos and video clips are officially stamped with your name.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {user ? (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition-colors"
            >
              Switch Crew Account
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Sign In / Join Crew</span>
            </button>
          )}
        </div>
      </div>

      {/* Auth Success Toast */}
      {authSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">Google Drive Connected Successfully!</span>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Your Google account is authorized. Photos and footage will now upload directly into the official SAVISKAR 2026 Google Drive folder structure.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAuthSuccessBanner(false)}
            className="text-xs font-semibold text-emerald-800 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Google Drive Integration Status Bar */}
      {driveStatus && (
        driveStatus.isConnected ? (
          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Google Drive Live Sync Active</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connected
                  </span>
                </div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Direct upload target: <span className="font-semibold text-slate-800">DSA MEDIAVERSE SAVISKAR 26</span> {driveStatus.userEmail ? `(${driveStatus.userEmail})` : ''}
                </p>
              </div>
            </div>
            <a
              href={driveStatus.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors self-start sm:self-auto shrink-0"
            >
              <span>Open Drive Root</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-950 text-sm">Google Drive Connection Required</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900">
                    Upload Authorization
                  </span>
                </div>
                <p className="text-amber-800 text-xs mt-0.5 leading-relaxed max-w-2xl">
                  To ensure photos and 4K footage stream into the official SAVISKAR 2026 Drive folder, camera crew must connect Google Drive before uploading.
                </p>
              </div>
            </div>
            {driveStatus.authUrl && (
              <a
                href={driveStatus.authUrl}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors self-start sm:self-auto shrink-0"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Connect Google Drive &rarr;</span>
              </a>
            )}
          </div>
        )
      )}

      {/* Grid: My Assignments List + Selected Assignment Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Assignments Selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              My Coverage Tasks
            </h2>
            <span className="text-xs font-bold text-slate-700">{myAssignments.length} active</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-600" />
              Loading assigned tasks...
            </div>
          ) : myAssignments.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-500">
              No assignments assigned to you yet. Check the Assignments page.
            </div>
          ) : (
            myAssignments.map(a => {
              const isSelected = selectedAssignment?.id === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => selectAssignment(a.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-red-50/50 border-red-300 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <PriorityBadge priority={a.priority} />
                    <StatusBadge status={a.status} size="sm" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{a.title}</h3>
                  <div className="mt-2.5 text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{a.location_name || 'Main Campus'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{a.day_session}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right 2 Columns: Live Task Checklist & Uploaded Media */}
        <div className="xl:col-span-2 space-y-6">
          {selectedAssignment ? (
            <>
              {/* Task Header & Specs Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={selectedAssignment.priority} />
                      <StatusBadge status={selectedAssignment.status} />
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {selectedAssignment.coverage_type}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedAssignment.title}</h2>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedAssignment.location_name} • {selectedAssignment.day_session}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {destinationFolderInfo?.driveFolderUrl && (
                      <a
                        href={destinationFolderInfo.driveFolderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
                        title="View folder in Google Drive"
                      >
                        <FolderOpen className="w-4 h-4 text-amber-500" />
                        <span>Open Drive Folder</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                    )}

                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>Upload Files</span>
                    </button>
                  </div>
                </div>

                {/* Destination Banner */}
                {destinationFolderInfo && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Automated Destination:</span>
                      <span className="font-mono font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {destinationFolderInfo.fullPath}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Auto-Mapped
                    </span>
                  </div>
                )}

                {/* Instructions Box */}
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60 space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Required Deliverable Brief
                  </h4>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium">
                    {selectedAssignment.expected_deliverable}
                  </p>
                  {selectedAssignment.notes && (
                    <p className="text-xs text-slate-500 pt-1 border-t border-slate-200/60">
                      <strong>Notes:</strong> {selectedAssignment.notes}
                    </p>
                  )}
                </div>

                {/* Interactive Shot Checklist */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Required Shot Checklist ({completedShotsCount}/{totalShotsCount})
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Tap each shot item as you complete it during coverage.
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900">{checklistProgressPercent}% Complete</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${checklistProgressPercent}%` }}
                    />
                  </div>

                  {selectedAssignment.checklist && selectedAssignment.checklist.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {selectedAssignment.checklist.map(item => (
                        <div
                          key={item.id}
                          onClick={() => handleToggleChecklist(item.id)}
                          className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                            item.is_completed
                              ? 'bg-emerald-50/60 border-emerald-200 text-slate-700'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                          }`}
                        >
                          {item.is_completed ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 shrink-0 hover:text-slate-400" />
                          )}
                          <span className={`text-xs font-semibold ${item.is_completed ? 'line-through text-slate-400' : ''}`}>
                            {item.shot_title}
                          </span>
                          {item.is_required && (
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              Mandatory
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      No specific shot items recorded for this assignment.
                    </div>
                  )}
                </div>
              </div>

              {/* Uploaded Media Gallery for this Assignment */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Uploaded Footage & Photos ({assignedMedia.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Files recorded and backed up to Google Drive for this assignment.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload More</span>
                  </button>
                </div>

                {assignedMedia.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No media uploaded yet for this assignment. Press "Upload Files" above to send photos directly to Google Drive.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {assignedMedia.map(m => (
                      <div
                        key={m.id}
                        className="rounded-xl border border-slate-200 overflow-hidden bg-white hover:border-slate-300 transition-shadow group flex flex-col"
                      >
                        <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center">
                          {m.drive_thumbnail_url ? (
                            <img
                              src={m.drive_thumbnail_url}
                              alt={m.filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="text-slate-400">
                              {m.media_type.includes('VIDEO') ? <Film className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                            </div>
                          )}
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
                            {m.media_type}
                          </span>
                        </div>
                        <div className="p-2.5 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-900 truncate" title={m.filename}>
                              {m.filename}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {formatFileSize(m.file_size_bytes || 0)} • {m.uploader_name}
                            </p>
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
                            <a
                              href={m.drive_web_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 hover:underline"
                            >
                              <span>Open in Drive</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-500">
              Select an assignment on the left to view required shots and upload media.
            </div>
          )}
        </div>
      </div>

      {/* Upload Media to Google Drive Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          if (!isUploading) {
            setShowUploadModal(false);
            setUploadFiles([]);
          }
        }}
        title={`Upload to ${destinationFolderInfo?.folderName || 'Google Drive'}`}
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500 font-semibold truncate mr-2">
              {uploadFiles.length > 0 ? `${uploadFiles.length} file(s) selected` : 'No files selected'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles([]);
                }}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={isUploading || uploadFiles.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Start Upload ({uploadFiles.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Assignment Selector inside Modal */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Target Assignment / Event Task
            </label>
            <select
              value={selectedAssignment?.id || ''}
              onChange={e => {
                const found = myAssignments.find(a => a.id === e.target.value);
                if (found) selectAssignment(found.id);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
            >
              <option value="" disabled>Select assignment for these files...</option>
              {myAssignments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.day_session} • {a.coverage_type})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Google Drive Folder Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-red-600" />
                <span>Destination Folder in Google Drive</span>
              </span>
              <div className="flex items-center gap-2">
                {selectedFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${selectedFolderId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-red-600 hover:underline flex items-center gap-0.5 normal-case"
                  >
                    <span>Open Folder</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <a
                  href="/drive"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-0.5 normal-case"
                >
                  <span>Build Structure ↗</span>
                </a>
              </div>
            </div>

            {driveFolders.length > 0 ? (
              <select
                value={selectedFolderPath || (destinationFolderInfo ? destinationFolderInfo.fullPath : '')}
                onChange={e => {
                  const chosen = driveFolders.find(f => f.path === e.target.value);
                  setSelectedFolderPath(e.target.value);
                  if (chosen && chosen.driveFolderId) {
                    setSelectedFolderId(chosen.driveFolderId);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
              >
                {driveFolders.map(item => (
                  <option key={item.path} value={item.path}>
                    {'\u00A0'.repeat(item.level * 3)}📁 {item.name} {item.driveFolderId ? '✓' : ''}
                  </option>
                ))}
              </select>
            ) : destinationFolderInfo ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-medium">Target Drive Folder:</span>
                  <span className="font-mono font-bold text-slate-900">{destinationFolderInfo.fullPath}</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Direct Cloud Sync
                </span>
              </div>
            ) : null}
            <p className="text-[10px] text-slate-500 font-mono truncate">
              {selectedFolderPath ? `Target Path: ${selectedFolderPath}` : ''}
            </p>
          </div>

          {/* Drive Authorization Warning if Not Connected */}
          {driveStatus && !driveStatus.isConnected && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Google Drive Authorization Required</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Photos and footage are streamed directly into the official SAVISKAR 2026 Google Drive root folder (<strong>DSA MEDIAVERSE SAVISKAR 26</strong>). To enable direct upload, please authorize Google Drive.
              </p>
              {driveStatus.authUrl && (
                <a
                  href={driveStatus.authUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Authorize Google Drive Now &rarr;</span>
                </a>
              )}
            </div>
          )}

          {uploadSummaryMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{uploadSummaryMessage}</span>
              </div>
              {selectedFolderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${selectedFolderId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 underline shrink-0 hover:text-emerald-700"
                >
                  <span>Open Folder in Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Drag & Drop File Picker Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-8 border-2 border-dashed border-slate-300 hover:border-red-500 rounded-2xl text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-red-50/20 group"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              onChange={handleFilesSelected}
              className="hidden"
            />
            <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-red-600 mx-auto mb-2 transition-colors" />
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-red-700">
              Select Photos or 4K Video Files
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Supports JPEG, PNG, RAW, MP4, MOV, and high-bitrate camera files.
            </p>
            <span className="inline-block mt-3 px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs">
              Browse Files
            </span>
          </div>

          {/* Queued Files List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Selected Files ({uploadFiles.length})</span>
                <button
                  onClick={() => setUploadFiles([])}
                  disabled={isUploading}
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  Clear all
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {uploadFiles.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            {item.mediaType.includes('VIDEO') ? <Film className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{item.file.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {formatFileSize(item.file.size)} • {item.mediaType}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'COMPLETED' ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" /> Uploaded
                            </span>
                            {item.driveWebUrl && (
                              <a
                                href={item.driveWebUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold text-red-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>File</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {item.driveFolderUrl && (
                              <a
                                href={item.driveFolderUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] font-semibold text-slate-600 hover:underline flex items-center gap-0.5"
                              >
                                <span>Folder</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : item.status === 'FAILED' ? (
                          <span className="text-xs font-bold text-red-600 flex items-center gap-1" title={item.error}>
                            <AlertCircle className="w-4 h-4" /> Failed
                          </span>
                        ) : item.status === 'UPLOADING' ? (
                          <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {item.progress}%
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRemoveQueuedFile(item.id)}
                            disabled={isUploading}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress indicator */}
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
      </Modal>
    </div>
  );
};
