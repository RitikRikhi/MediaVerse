import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Assignment, ShotChecklistItem, AssignmentStatus, PriorityLevel, CoverageType } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  FolderOpen,
  MapPin,
  Clock,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const AssignmentsPage: React.FC = () => {
  const { isCoordinator, isSuperAdmin, allUsers } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<(Assignment & { checklist: ShotChecklistItem[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [coverageFilter, setCoverageFilter] = useState<string>('ALL');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTargetAssignment, setStatusTargetAssignment] = useState<Assignment | null>(null);
  const [newStatus, setNewStatus] = useState<AssignmentStatus>('CAPTURING');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusError, setStatusError] = useState('');

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formCoverage, setFormCoverage] = useState<CoverageType>('PHOTOGRAPHY');
  const [formPriority, setFormPriority] = useState<PriorityLevel>('MEDIUM');
  const [formSession, setFormSession] = useState('Day 1 - Morning');
  const [formStartTime, setFormStartTime] = useState('2026-10-28T09:00');
  const [formDeadline, setFormDeadline] = useState('2026-10-28T13:00');
  const [formDeliverable, setFormDeliverable] = useState('');
  const [formDriveUrl, setFormDriveUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAssignedUsers, setFormAssignedUsers] = useState<string[]>([]);
  const [formChecklist, setFormChecklist] = useState<string[]>(['Key VIP Arrival', 'Main Stage Performance']);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load assignments', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  // Filter effect
  useEffect(() => {
    let result = [...assignments];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.expected_deliverable.toLowerCase().includes(q) ||
          (a.location_name && a.location_name.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== 'ALL') {
      result = result.filter(a => a.status === statusFilter);
    }
    if (coverageFilter !== 'ALL') {
      result = result.filter(a => a.coverage_type === coverageFilter);
    }
    setFilteredAssignments(result);
  }, [assignments, search, statusFilter, coverageFilter]);

  const handleOpenDetail = async (id: string) => {
    try {
      const details = await api.getAssignment(id);
      setSelectedAssignment(details);
    } catch (err) {
      console.error('Failed to load assignment detail', err);
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
      loadAssignments();
    } catch (err) {
      console.error('Failed to toggle checklist', err);
    }
  };

  const handleOpenStatusModal = (assignment: Assignment) => {
    setStatusTargetAssignment(assignment);
    setStatusNotes('');
    setStatusError('');
    setShowStatusModal(true);
  };

  const handleSaveStatus = async () => {
    if (!statusTargetAssignment) return;
    try {
      setStatusError('');
      await api.updateAssignmentStatus(statusTargetAssignment.id, newStatus, statusNotes);
      setShowStatusModal(false);
      loadAssignments();
      if (selectedAssignment?.id === statusTargetAssignment.id) {
        handleOpenDetail(statusTargetAssignment.id);
      }
    } catch (err: any) {
      setStatusError(err.message || 'Status transition failed.');
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAssignment({
        event_id: assignments[0]?.event_id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: formTitle,
        coverage_type: formCoverage,
        priority: formPriority,
        day_session: formSession,
        start_time: new Date(formStartTime).toISOString(),
        deadline: new Date(formDeadline).toISOString(),
        expected_deliverable: formDeliverable,
        drive_folder_url: formDriveUrl || undefined,
        notes: formNotes || undefined,
        assigned_user_ids: formAssignedUsers,
        checklist_items: formChecklist.filter(Boolean).map(shot_title => ({
          shot_title,
          is_required: true
        }))
      });

      setShowCreateModal(false);
      setFormTitle('');
      setFormDeliverable('');
      setFormDriveUrl('');
      setFormNotes('');
      setFormAssignedUsers([]);
      loadAssignments();
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Operations Roster
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            SAVISKAR 2026 Assignments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Field photography, 4K multi-cam coverage, editing directives, and delivery milestones.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(isCoordinator || isSuperAdmin) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Assignment</span>
            </button>
          )}

          <Link
            to="/field-crew"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors border border-slate-200"
          >
            <span>Upload View</span>
          </Link>
        </div>
      </div>

      {/* Filters bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, deliverable, or venue..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CAPTURING">Capturing</option>
            <option value="UPLOAD_PENDING">Upload Pending</option>
            <option value="AVAILABLE_FOR_EDITING">Ready for Edit</option>
            <option value="EDITING">Editing</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="REVISION_REQUIRED">Revisions Needed</option>
            <option value="APPROVED">Approved</option>
            <option value="DELIVERED">Delivered</option>
          </select>

          {/* Coverage filter */}
          <select
            value={coverageFilter}
            onChange={e => setCoverageFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Coverage</option>
            <option value="PHOTOGRAPHY">Photography</option>
            <option value="VIDEOGRAPHY">Videography</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </div>
      </div>

      {/* Assignment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs font-medium">
            Loading assignments...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200 p-8">
            No assignments match your search and filter criteria.
          </div>
        ) : (
          filteredAssignments.map(assignment => (
            <div
              key={assignment.id}
              className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-card hover:border-slate-300 hover:shadow-card-hover transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={assignment.priority} />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {assignment.coverage_type}
                    </span>
                  </div>
                  <StatusBadge status={assignment.status} />
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {assignment.title}
                </h3>

                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{assignment.location_name || 'Auditorium / Campus Venue'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{assignment.day_session}</span>
                    <span className="text-slate-300">•</span>
                    <span>Due: {new Date(assignment.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                  <span className="text-slate-500 font-semibold block mb-0.5">Required Deliverable:</span>
                  <span className="font-medium">{assignment.expected_deliverable}</span>
                </div>
              </div>

              {/* Members & Shot progress */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {assignment.assigned_members && assignment.assigned_members.length > 0 ? (
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {assignment.assigned_members.map(m => (
                        <div
                          key={m.user_id}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-[10px] font-bold text-red-700 border border-white"
                          title={`${m.full_name} (${m.role})`}
                        >
                          {m.full_name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                  )}

                  {assignment.checklist_summary && assignment.checklist_summary.total > 0 && (
                    <span className="text-[11px] text-slate-500 font-medium ml-1">
                      ✓ {assignment.checklist_summary.completed}/{assignment.checklist_summary.total} shots
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {assignment.drive_folder_url && (
                    <a
                      href={assignment.drive_folder_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Open Google Drive folder"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenStatusModal(assignment)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    Status
                  </button>

                  <button
                    onClick={() => handleOpenDetail(assignment.id)}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    Checklist
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail & Shot Checklist Modal */}
      {selectedAssignment && (
        <Modal
          isOpen={Boolean(selectedAssignment)}
          onClose={() => setSelectedAssignment(null)}
          title={selectedAssignment.title}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={selectedAssignment.priority} />
              <StatusBadge status={selectedAssignment.status} />
              <span className="text-xs text-slate-500 font-medium">• {selectedAssignment.day_session}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <p>
                <span className="text-slate-500 font-semibold">Expected Deliverable: </span>
                <span className="text-slate-900 font-medium">{selectedAssignment.expected_deliverable}</span>
              </p>
              {selectedAssignment.notes && (
                <p>
                  <span className="text-slate-500 font-semibold">Crew Notes: </span>
                  <span className="text-slate-700">{selectedAssignment.notes}</span>
                </p>
              )}
            </div>

            {/* Interactive Shot Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Shot Checklist</h4>
                <span className="text-xs text-slate-500 font-medium">
                  {selectedAssignment.checklist.filter(c => c.is_completed).length} of{' '}
                  {selectedAssignment.checklist.length} completed
                </span>
              </div>

              {selectedAssignment.checklist.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No checklist items recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedAssignment.checklist.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(item.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-start gap-3 ${
                        item.is_completed
                          ? 'bg-emerald-50/60 border-emerald-200 text-slate-600'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
                      }`}
                    >
                      <button className="mt-0.5 text-red-600 shrink-0">
                        {item.is_completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${item.is_completed ? 'line-through text-slate-400' : ''}`}>
                            {item.shot_title}
                          </span>
                          {item.is_required && (
                            <span className="text-[10px] uppercase font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              Required
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end">
              <Link
                to="/field-crew"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                <span>Upload Media for this Task &rarr;</span>
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {/* Change Status Modal */}
      {showStatusModal && statusTargetAssignment && (
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title={`Update Status: ${statusTargetAssignment.title}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 font-medium">Current Status:</p>
              <div className="mt-1">
                <StatusBadge status={statusTargetAssignment.status} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select New Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as AssignmentStatus)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-red-500"
              >
                <option value="ASSIGNED">ASSIGNED (Initial Planning)</option>
                <option value="CAPTURING">CAPTURING (Field Crew Active)</option>
                <option value="UPLOAD_PENDING">UPLOAD_PENDING (Footage Shot, Awaiting Upload)</option>
                <option value="AVAILABLE_FOR_EDITING">AVAILABLE_FOR_EDITING (Raw Media Ready for Editors)</option>
                <option value="EDITING">EDITING (Video Editor Assembling Cuts)</option>
                <option value="IN_REVIEW">IN_REVIEW (Edit Submitted for Review)</option>
                <option value="REVISION_REQUIRED">REVISION_REQUIRED (Changes Requested)</option>
                <option value="APPROVED">APPROVED (QC Approved)</option>
                <option value="DELIVERED">DELIVERED (Final High-Res Delivered)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status Notes / Reason</label>
              <textarea
                value={statusNotes}
                onChange={e => setStatusNotes(e.target.value)}
                placeholder="e.g., Raw 4K clips uploaded to Day 1 folder, ready for editing."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            {statusError && (
              <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                {statusError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
              >
                Save Status Transition
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Assignment Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create SAVISKAR 2026 Assignment"
          maxWidth="2xl"
        >
          <form onSubmit={handleCreateAssignment} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assignment Title *</label>
              <input
                type="text"
                required
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="e.g. Celebrity Star Night Stage Coverage"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Coverage Type</label>
                <select
                  value={formCoverage}
                  onChange={e => setFormCoverage(e.target.value as CoverageType)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="PHOTOGRAPHY">Photography</option>
                  <option value="VIDEOGRAPHY">Videography</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={e => setFormPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Session / Slot</label>
                <input
                  type="text"
                  required
                  value={formSession}
                  onChange={e => setFormSession(e.target.value)}
                  placeholder="Day 1 - Evening"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  required
                  value={formStartTime}
                  onChange={e => setFormStartTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Deadline</label>
                <input
                  type="datetime-local"
                  required
                  value={formDeadline}
                  onChange={e => setFormDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Deliverable *</label>
              <input
                type="text"
                required
                value={formDeliverable}
                onChange={e => setFormDeliverable(e.target.value)}
                placeholder="e.g. 50 curated high-res edited photos + RAW folder link"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Crew Assignees */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assign Crew Members</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {allUsers
                  .filter(u => u.roles.some(r => ['PHOTOGRAPHER', 'VIDEOGRAPHER', 'VIDEO_EDITOR'].includes(r)))
                  .map(member => (
                    <label
                      key={member.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        formAssignedUsers.includes(member.id)
                          ? 'bg-red-50 border-red-300 text-red-900 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formAssignedUsers.includes(member.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setFormAssignedUsers([...formAssignedUsers, member.id]);
                          } else {
                            setFormAssignedUsers(formAssignedUsers.filter(id => id !== member.id));
                          }
                        }}
                        className="rounded text-red-600 focus:ring-0"
                      />
                      <span className="truncate">{member.full_name}</span>
                    </label>
                  ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs"
              >
                Create Assignment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
