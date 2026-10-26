import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { EditingProject, MediaAsset, EditVersion } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import {
  Film,
  FolderOpen,
  Send,
  MessageSquare,
  Clock,
  Sparkles,
  ExternalLink,
  Play,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Plus,
  Layers,
  ChevronRight,
  UploadCloud,
  FileUp,
  Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const EditorWorkspacePage: React.FC = () => {
  const { user, setShowAuthModal } = useAuth();
  const [projects, setProjects] = useState<EditingProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<EditingProject | null>(null);
  const [availableFootage, setAvailableFootage] = useState<MediaAsset[]>([]);
  const [driveFolders, setDriveFolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Submit Version Modal
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [submitMode, setSubmitMode] = useState<'FILE' | 'LINK'>('FILE');
  const [versionLabel, setVersionLabel] = useState('v1 Rough Cut');
  const [driveWebUrl, setDriveWebUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [selectedFolderPath, setSelectedFolderPath] = useState('/DSA MEDIAVERSE SAVISKAR 26/Reels & Edits/In Review Cuts');
  const [cutFile, setCutFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingCut, setIsUploadingCut] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create Project Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBrief, setNewBrief] = useState('');
  const [newAspectRatio, setNewAspectRatio] = useState('9:16');
  const [newSpecs, setNewSpecs] = useState('1080x1920 MP4 60fps H.264');
  const [newPriority, setNewPriority] = useState<'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [newDeadline, setNewDeadline] = useState('2026-10-28T20:00:00');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [projList, mediaList] = await Promise.all([
        api.getEditingProjects(),
        api.getMediaAssets()
      ]);
      setProjects(projList);
      setAvailableFootage(mediaList.filter(m => m.media_type === 'RAW_VIDEO' || m.media_type === 'AUDIO_STEM'));

      if (projList.length > 0 && !selectedProject) {
        setSelectedProject(projList[0]);
      }
    } catch (err) {
      console.error('Failed to load editor workspace', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    api.getDriveFolderStructure()
      .then(res => {
        if (res && res.flatList && res.flatList.length > 0) {
          setDriveFolders(res.flatList);
          const reviewFolder = res.flatList.find(f => f.path.includes('Reels & Edits') || f.path.includes('Review Versions'));
          if (reviewFolder) {
            setSelectedFolderPath(reviewFolder.path);
            if (reviewFolder.driveFolderId) setSelectedFolderId(reviewFolder.driveFolderId);
          }
        }
      })
      .catch(err => console.warn('Could not load drive folders list', err));
  }, [user]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBrief.trim()) return;

    setCreateLoading(true);
    setCreateError('');
    try {
      const created = await api.createEditingProject({
        title: newTitle.trim(),
        brief: newBrief.trim(),
        aspect_ratio: newAspectRatio,
        deliverable_specs: newSpecs,
        priority: newPriority,
        deadline: newDeadline
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewBrief('');
      await loadData();
      setSelectedProject(created);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create editing project');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSubmitVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitError('');
    setSubmitSuccess('');

    try {
      if (submitMode === 'FILE') {
        if (!cutFile) {
          setSubmitError('Please select a video cut file to upload to Google Drive.');
          return;
        }

        setIsUploadingCut(true);
        const formData = new FormData();
        formData.append('file', cutFile);
        formData.append('version_label', versionLabel);
        formData.append('notes', notes);
        if (selectedFolderId) formData.append('target_folder_id', selectedFolderId);
        if (selectedFolderPath) formData.append('target_folder_path', selectedFolderPath);

        await api.uploadEditVersionFile(selectedProject.id, formData, percent => {
          setUploadProgress(percent);
        });

        setSubmitSuccess(`File "${cutFile.name}" uploaded to Google Drive as "${versionLabel}" and submitted for review!`);
      } else {
        if (!driveWebUrl.trim()) {
          setSubmitError('Please enter a valid Google Drive URL.');
          return;
        }

        await api.submitEditVersion(selectedProject.id, {
          version_label: versionLabel,
          drive_web_url: driveWebUrl.trim(),
          preview_url: previewUrl || undefined,
          notes
        });

        setSubmitSuccess(`Version "${versionLabel}" submitted for review.`);
      }

      const updated = await api.getEditingProject(selectedProject.id);
      setSelectedProject(updated);
      setCutFile(null);
      setUploadProgress(0);
      setDriveWebUrl('');
      setPreviewUrl('');
      setNotes('');
      loadData();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit edit version.');
    } finally {
      setIsUploadingCut(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Editor Header Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Post-Production Studio
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026 Production</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Video Editing Studio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Access 4K raw stems from Google Drive, create reels, upload cuts directly to Google Drive, and manage reviewer feedback.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => {
              if (!user) {
                setShowAuthModal(true);
                return;
              }
              setCreateError('');
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-700" />
            <span>New Edit Project</span>
          </button>

          <Link
            to="/ai"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-red-600" />
            <span>AI Edit Brief</span>
          </Link>

          {selectedProject && (
            <button
              onClick={() => {
                if (!user) {
                  setShowAuthModal(true);
                  return;
                }
                const nextNum = (selectedProject.versions?.length || 0) + 1;
                setVersionLabel(nextNum === 1 ? 'v1 Rough Cut' : `v${nextNum} Revised Cut`);
                setSubmitSuccess('');
                setSubmitError('');
                setCutFile(null);
                setUploadProgress(0);
                setShowVersionModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Submit Version Cut</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Crew Identity Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
        user ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/80 border-amber-300'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
            user ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            {user ? (user.full_name?.charAt(0) || 'E') : '?'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                {user ? `Editor Studio Active: ${user.full_name}` : 'Not Signed In (Editor Guest Mode)'}
              </span>
              {user?.roles?.[0] && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                  {user.roles[0]}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {user
                ? `Edit versions uploaded will be credited to "${user.full_name}" and submitted directly to the Review & QC pipeline.`
                : 'Sign in with your crew account to upload video cuts and receive approval notices from coordinators.'}
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
              <FileUp className="w-3.5 h-3.5" />
              <span>Sign In / Join as Editor</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid: Projects list on left, Project Details and Versions on right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Projects & Footage Bank */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Assigned Edit Projects
              </h2>
              <span className="text-xs font-bold text-slate-700">{projects.length} active</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 space-y-3">
                <p>No active editing projects found.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  Create First Project
                </button>
              </div>
            ) : (
              projects.map(proj => {
                const isSelected = selectedProject?.id === proj.id;
                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProject(proj)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-red-50/50 border-red-300 shadow-xs'
                        : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <PriorityBadge priority={proj.priority} />
                      <StatusBadge status={proj.status} size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{proj.title}</h3>
                    <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                      <span className="font-semibold">{proj.aspect_ratio}</span>
                      <span>{proj.versions?.length || 0} versions</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Raw Footage Bank */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Raw Footage Stems in Drive
              </h3>
              <span className="text-[11px] font-bold text-slate-500">{availableFootage.length} clips</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {availableFootage.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 text-center">No raw video stems registered yet.</p>
              ) : (
                availableFootage.map(footage => (
                  <div
                    key={footage.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="overflow-hidden">
                      <p className="font-bold text-slate-900 truncate">{footage.filename}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {footage.assignment_title || 'SAVISKAR Event'}
                      </p>
                    </div>

                    <a
                      href={footage.drive_web_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 shrink-0 transition-colors"
                      title="Open clip in Google Drive"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Project Creative Brief & Versions History */}
        <div className="xl:col-span-2 space-y-6">
          {selectedProject ? (
            <div className="space-y-6">
              {/* Creative Brief Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={selectedProject.priority} />
                      <StatusBadge status={selectedProject.status} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedProject.title}</h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const nextNum = (selectedProject.versions?.length || 0) + 1;
                        setVersionLabel(nextNum === 1 ? 'v1 Rough Cut' : `v${nextNum} Revised Cut`);
                        setSubmitSuccess('');
                        setSubmitError('');
                        setCutFile(null);
                        setUploadProgress(0);
                        setShowVersionModal(true);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Version Cut</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Aspect Ratio</span>
                    <span className="font-bold text-slate-800">{selectedProject.aspect_ratio}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Delivery Specs</span>
                    <span className="font-bold text-slate-800">{selectedProject.deliverable_specs}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Assigned Editor</span>
                    <span className="font-bold text-slate-800">{selectedProject.assigned_editor_name || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">QC Deadline</span>
                    <span className="font-bold text-slate-800">
                      {new Date(selectedProject.deadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Creative Brief & Music Stems</h4>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedProject.brief}</p>
                </div>
              </div>

              {/* Version History & Reviews */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Submitted Timeline Cuts</h3>
                  <span className="text-xs text-slate-500 font-semibold">
                    {selectedProject.versions?.length || 0} iterations
                  </span>
                </div>

                {selectedProject.versions && selectedProject.versions.length > 0 ? (
                  <div className="space-y-4">
                    {selectedProject.versions.map(ver => (
                      <div
                        key={ver.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-900 text-white">
                              {ver.version_label}
                            </span>
                            <span className="text-xs text-slate-500">
                              By {ver.submitted_by_name || 'Editor'} •{' '}
                              {new Date(ver.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <a
                            href={ver.drive_web_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Watch Cut in Drive</span>
                          </a>
                        </div>

                        {ver.notes && (
                          <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/60 italic">
                            "{ver.notes}"
                          </p>
                        )}

                        {/* Review Comments */}
                        {ver.comments && ver.comments.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block">
                              QC Feedback from Reviewer
                            </span>
                            {ver.comments.map(c => (
                              <div
                                key={c.id}
                                className="p-2.5 rounded-lg bg-red-50/60 border border-red-100 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-red-900">{c.reviewer_name || 'Reviewer'}</span>
                                  {c.timecode_seconds !== undefined && (
                                    <span className="text-[10px] font-mono font-bold text-red-600">
                                      @{Math.floor(c.timecode_seconds / 60)}:{(c.timecode_seconds % 60).toString().padStart(2, '0')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-700">{c.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
                    <FileVideo className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700">No edit versions submitted yet.</p>
                    <p className="text-[11px] text-slate-400">
                      Export your cut and upload it directly or paste the Drive link to submit for approval.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 space-y-2">
              <Film className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">Select a project to view timeline specs and cuts</p>
            </div>
          )}
        </div>
      </div>

      {/* Submit Version Cut Modal */}
      <Modal
        isOpen={showVersionModal}
        onClose={() => {
          if (!isUploadingCut) setShowVersionModal(false);
        }}
        title={`Submit Edit Cut for Review: ${selectedProject?.title}`}
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500 font-medium truncate mr-2">
              {submitMode === 'FILE' && cutFile ? cutFile.name : ''}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isUploadingCut}
                onClick={() => setShowVersionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="version-cut-form"
                disabled={isUploadingCut}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploadingCut ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Uploading Cut...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for QC Review</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <form id="version-cut-form" onSubmit={handleSubmitVersion} className="space-y-4">
          {submitSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setSubmitMode('FILE')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                submitMode === 'FILE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-red-600" />
              <span>Direct File Upload to Drive</span>
            </button>
            <button
              type="button"
              onClick={() => setSubmitMode('LINK')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                submitMode === 'LINK'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Paste Google Drive Link</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Version Label *</label>
            <input
              type="text"
              required
              value={versionLabel}
              onChange={e => setVersionLabel(e.target.value)}
              placeholder="e.g. v1 Rough Cut (9:16 vertical)"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>

          {submitMode === 'FILE' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Video Cut File (.mp4, .mov, etc.) *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
                    cutFile ? 'border-emerald-400 bg-emerald-50/30' : 'border-slate-300 hover:border-red-400 bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setCutFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  {cutFile ? (
                    <div className="space-y-1">
                      <FileVideo className="w-8 h-8 text-emerald-600 mx-auto" />
                      <p className="text-xs font-bold text-emerald-900">{cutFile.name}</p>
                      <p className="text-[11px] text-emerald-700 font-mono">
                        {(cutFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">Click or drag video file here</p>
                      <p className="text-[11px] text-slate-400">File will upload straight to Google Drive in the background</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Target Drive Folder */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Google Drive Folder</label>
                <select
                  value={selectedFolderPath}
                  onChange={e => {
                    setSelectedFolderPath(e.target.value);
                    const found = driveFolders.find(f => f.path === e.target.value);
                    if (found && found.driveFolderId) setSelectedFolderId(found.driveFolderId);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
                >
                  <option value="/DSA MEDIAVERSE SAVISKAR 26/Reels & Edits/In Review Cuts">
                    /Reels & Edits/In Review Cuts (Default)
                  </option>
                  {driveFolders.map(f => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                    </option>
                  ))}
                </select>
              </div>

              {isUploadingCut && (
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Uploading to Google Drive...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-red-600 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Google Drive Review Video Link *</label>
              <input
                type="url"
                required
                value={driveWebUrl}
                onChange={e => setDriveWebUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-red-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Paste the share link of the video already in your SAVISKAR Google Drive.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Editor Notes for Reviewer</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g., Color grading matched with brand guide, high energy music beat drops aligned with coding clips."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>
        </form>
      </Modal>

      {/* Create New Editing Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New SAVISKAR Editing Project"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              disabled={createLoading}
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-project-form"
              disabled={createLoading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {createLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        }
      >
        <form id="create-project-form" onSubmit={handleCreateProject} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Project Title *</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. Day 1 Inauguration 60-Sec Reel"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Aspect Ratio</label>
              <select
                value={newAspectRatio}
                onChange={e => setNewAspectRatio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
              >
                <option value="9:16">9:16 (Vertical Reel / Shorts / TikTok)</option>
                <option value="16:9">16:9 (Cinematic Horizontal / YouTube)</option>
                <option value="1:1">1:1 (Square Post)</option>
                <option value="4:5">4:5 (Portrait Post)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
              >
                <option value="URGENT">URGENT (Same-day release)</option>
                <option value="HIGH">HIGH (Standard festival pace)</option>
                <option value="MEDIUM">MEDIUM (Recap / Archive)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Specifications</label>
            <input
              type="text"
              value={newSpecs}
              onChange={e => setNewSpecs(e.target.value)}
              placeholder="e.g. 1080x1920 MP4 60fps H.264"
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Creative Brief & Key Milestones *</label>
            <textarea
              required
              rows={4}
              value={newBrief}
              onChange={e => setNewBrief(e.target.value)}
              placeholder="Describe tone, pacing, key dignitaries to highlight, music style, and graphic lower thirds..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
