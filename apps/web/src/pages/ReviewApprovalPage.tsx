import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { EditingProject, EditVersion, ReviewComment } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle,
  AlertOctagon,
  MessageSquare,
  Clock,
  Play,
  FolderOpen,
  Send,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const ReviewApprovalPage: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<EditingProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<EditingProject | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<EditVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Timecode comment state
  const [commentText, setCommentText] = useState('');
  const [timecodeSeconds, setTimecodeSeconds] = useState<number | undefined>(undefined);

  // Decision Modal
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<'APPROVED' | 'REVISION_REQUESTED'>('APPROVED');
  const [feedbackText, setFeedbackText] = useState('');
  const [isFinalDelivery, setIsFinalDelivery] = useState(false);
  const [decisionError, setDecisionError] = useState('');
  const [decisionSuccess, setDecisionSuccess] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const list = await api.getEditingProjects();
      setProjects(list);

      if (list.length > 0 && !selectedProject) {
        setSelectedProject(list[0]);
        if (list[0].versions && list[0].versions.length > 0) {
          setSelectedVersion(list[0].versions[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load review data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectProject = (project: EditingProject) => {
    setSelectedProject(project);
    if (project.versions && project.versions.length > 0) {
      setSelectedVersion(project.versions[0]);
    } else {
      setSelectedVersion(null);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVersion || !commentText.trim()) return;

    try {
      const newComment = await api.addReviewComment({
        edit_version_id: selectedVersion.id,
        comment: commentText,
        timecode_seconds: timecodeSeconds
      });

      setSelectedVersion(prev => {
        if (!prev) return null;
        return {
          ...prev,
          comments: [...(prev.comments || []), newComment]
        };
      });

      setCommentText('');
      setTimecodeSeconds(undefined);
    } catch (err: any) {
      alert(err.message || 'Failed to submit comment');
    }
  };

  const handleSubmitDecision = async () => {
    if (!selectedVersion || !feedbackText.trim()) return;
    setDecisionError('');
    setDecisionSuccess('');

    try {
      await api.submitReviewDecision({
        edit_version_id: selectedVersion.id,
        decision: decisionType,
        feedback: feedbackText,
        is_final_delivery: isFinalDelivery
      });

      setDecisionSuccess(
        decisionType === 'APPROVED'
          ? isFinalDelivery
            ? 'Deliverable finalized and marked as DELIVERED.'
            : 'Version approved. Ready for delivery.'
          : 'Revision feedback sent to editor.'
      );

      if (selectedProject) {
        const updated = await api.getEditingProject(selectedProject.id);
        setSelectedProject(updated);
        const updatedVersion = updated.versions?.find(v => v.id === selectedVersion.id);
        if (updatedVersion) setSelectedVersion(updatedVersion);
      }
      loadData();
    } catch (err: any) {
      setDecisionError(err.message || 'Failed to record decision');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              QC Review & Approvals
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Review & Approval Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit submitted video cuts, log timecoded revision feedback, and grant final broadcast approvals.
          </p>
        </div>

        {selectedVersion && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setDecisionType('REVISION_REQUESTED');
                setFeedbackText('');
                setDecisionError('');
                setDecisionSuccess('');
                setShowDecisionModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-red-50 text-red-700 border border-red-200 transition-colors"
            >
              <AlertOctagon className="w-4 h-4 text-red-600" />
              <span>Request Changes</span>
            </button>

            <button
              onClick={() => {
                setDecisionType('APPROVED');
                setFeedbackText('Approved. High retention pacing, excellent audio mix, and flawless color grade.');
                setDecisionError('');
                setDecisionSuccess('');
                setShowDecisionModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Approve Final Cut</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid: Projects list on left, Version Preview and Review feed on right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Col: Projects List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Projects Awaiting Review
            </h2>
            <span className="text-xs font-bold text-slate-700">{projects.length} total</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading review queue...
            </div>
          ) : projects.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-white border border-slate-200 text-xs text-slate-500">
              No projects pending review.
            </div>
          ) : (
            projects.map(proj => {
              const isSelected = selectedProject?.id === proj.id;
              return (
                <div
                  key={proj.id}
                  onClick={() => handleSelectProject(proj)}
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
                    <span className="font-medium">Editor: {proj.assigned_editor_name || 'Simran Kaur'}</span>
                    <span>{proj.versions?.length || 0} versions</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right 2 Cols: Version Player, Timecode feedback & Comments */}
        <div className="xl:col-span-2 space-y-6">
          {selectedProject ? (
            <div className="space-y-6">
              {/* Version Selector Tabs */}
              {selectedProject.versions && selectedProject.versions.length > 0 ? (
                <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 mr-2 uppercase tracking-wider text-[10px]">
                    Available Cuts:
                  </span>
                  {selectedProject.versions.map(v => {
                    const isVSelected = selectedVersion?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVersion(v)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                          isVSelected
                            ? 'bg-red-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {v.version_label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500">
                  No versions submitted for this project yet.
                </div>
              )}

              {selectedVersion && (
                <>
                  {/* Video Player / Drive Embed Box */}
                  <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {selectedVersion.version_label} • Review Cut
                        </h3>
                        <p className="text-xs text-slate-500">
                          Format: {selectedProject.aspect_ratio} • Submitted: {new Date(selectedVersion.submitted_at).toLocaleString()}
                        </p>
                      </div>

                      <a
                        href={selectedVersion.drive_web_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                        <span>Open in Google Drive</span>
                      </a>
                    </div>

                    {/* Google Drive Preview Player */}
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
                      {selectedVersion.drive_web_url.includes('/file/d/') ? (
                        <iframe
                          src={selectedVersion.drive_web_url.replace('/view', '/preview')}
                          title="Google Drive Review Player"
                          className="w-full h-full border-0"
                          allow="autoplay"
                        />
                      ) : (
                        <div className="text-center p-6 space-y-3">
                          <Play className="w-12 h-12 text-slate-400 mx-auto" />
                          <p className="text-xs text-slate-300">
                            Playback ready in Google Drive. Click below to stream the high-resolution file.
                          </p>
                          <a
                            href={selectedVersion.drive_web_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Launch Drive Player</span>
                          </a>
                        </div>
                      )}
                    </div>

                    {selectedVersion.notes && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                        <strong className="text-slate-900">Editor Notes: </strong>
                        {selectedVersion.notes}
                      </div>
                    )}
                  </div>

                  {/* Feedback Comments & Timecoded Notes */}
                  <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-red-600" />
                        <h3 className="text-sm font-bold text-slate-900">
                          Reviewer Feedback & Timecode Notes
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {selectedVersion.comments?.length || 0} comments
                      </span>
                    </div>

                    {/* Add Comment Form */}
                    <form onSubmit={handleAddComment} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="w-full sm:w-36">
                          <input
                            type="number"
                            min="0"
                            placeholder="Timecode (sec)"
                            value={timecodeSeconds !== undefined ? timecodeSeconds : ''}
                            onChange={e => setTimecodeSeconds(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500 font-mono"
                          />
                        </div>

                        <input
                          type="text"
                          required
                          placeholder="Add revision note (e.g. 'Lower music level under speech by 3dB')..."
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                        />

                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-colors shrink-0 flex items-center justify-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Post Note</span>
                        </button>
                      </div>
                    </form>

                    {/* Comments Feed */}
                    <div className="space-y-3">
                      {selectedVersion.comments && selectedVersion.comments.length > 0 ? (
                        selectedVersion.comments.map(c => (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">{c.reviewer_name || 'Reviewer'}</span>
                              <div className="flex items-center gap-2">
                                {c.timecode_seconds !== undefined && (
                                  <span className="text-[10px] font-mono font-bold bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                                    @{Math.floor(c.timecode_seconds / 60)}:{(c.timecode_seconds % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed font-medium">{c.comment}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 py-4 text-center italic">
                          No notes on this version yet. Review the cut above and leave feedback.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 text-slate-400 space-y-2">
              <Play className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-600">Select a project from the left to start quality control</p>
            </div>
          )}
        </div>
      </div>

      {/* Decision Modal */}
      <Modal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title={decisionType === 'APPROVED' ? 'Approve Version & Grant Broadcast Clearance' : 'Request Revisions from Editor'}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {decisionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{decisionSuccess}</span>
            </div>
          )}

          {decisionError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{decisionError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {decisionType === 'APPROVED' ? 'Approval Summary & Notes *' : 'Detailed Revision Requirements *'}
            </label>
            <textarea
              required
              value={feedbackText}
              onChange={e => setFeedbackText(e.target.value)}
              placeholder="State clear reasons or required changes..."
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>

          {decisionType === 'APPROVED' && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isFinalDelivery}
                onChange={e => setIsFinalDelivery(e.target.checked)}
                className="rounded text-red-600 focus:ring-0"
              />
              <div>
                <span className="font-bold text-slate-900">Mark as Final Deliverable (Broadcast Master)</span>
                <p className="text-[11px] text-slate-500">
                  Transitions project to DELIVERED status and informs campus social media coordinators.
                </p>
              </div>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDecisionModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitDecision}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs ${
                decisionType === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {decisionType === 'APPROVED' ? 'Confirm Approval' : 'Send Revision Feedback'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
