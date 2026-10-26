import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { FolderNode, PersonalDriveInfo, PersonalSubfolder, UserRole } from '../../types';
import { Modal } from '../ui/Modal';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Camera,
  Film,
  Scissors,
  HardDrive,
  User,
  Plus,
  Check,
  ExternalLink,
  Search,
  RefreshCw,
  Sparkles,
  Settings,
  Shield,
  Layers,
  Calendar,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Zap
} from 'lucide-react';

interface InteractiveFolderTreeProps {
  selectedFolderId: string;
  selectedFolderPath: string;
  onSelectFolder: (folderId: string, folderPath: string, mode: 'OFFICIAL' | 'PERSONAL') => void;
  currentUser?: {
    id: string;
    full_name: string;
    email?: string;
    roles?: UserRole[];
  } | null;
  activeRole?: string;
  onClose?: () => void;
}

export const InteractiveFolderTree: React.FC<InteractiveFolderTreeProps> = ({
  selectedFolderId,
  selectedFolderPath,
  onSelectFolder,
  currentUser,
  activeRole = 'PHOTOGRAPHER',
  onClose
}) => {
  // Tree & Drive state
  const [masterTree, setMasterTree] = useState<FolderNode | null>(null);
  const [personalDrive, setPersonalDrive] = useState<PersonalDriveInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'MASTER' | 'PERSONAL'>('MASTER');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [toastMessage, setToastMessage] = useState<string>('');

  // Inline subfolder creation state
  const [addingSubfolderParentId, setAddingSubfolderParentId] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState<string>('');
  const [isSubmittingSubfolder, setIsSubmittingSubfolder] = useState<boolean>(false);

  // Setup Wizard Modal state
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [wizardRole, setWizardRole] = useState<UserRole>((activeRole as UserRole) || 'PHOTOGRAPHER');
  const [wizardMode, setWizardMode] = useState<'ROLE_SPECIFIC' | 'FULL_EVENT'>('ROLE_SPECIFIC');
  const [wizardEmail, setWizardEmail] = useState<string>(currentUser?.email || '');
  const [isSettingUpDrive, setIsSettingUpDrive] = useState<boolean>(false);

  // Rename & Delete state for personal subfolders
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState<string>('');

  // Show temporary toast notification
  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Fetch unified tree and personal drive
  const loadTreeData = async () => {
    try {
      setIsLoading(true);
      const res = await api.getDriveTree();
      if (res && res.masterTree) {
        setMasterTree(res.masterTree);
        // Auto-expand root and top-level day folders by default
        const initialExpanded = new Set<string>(['root', res.masterTree.path]);
        if (res.masterTree.children) {
          res.masterTree.children.forEach(c => initialExpanded.add(c.path));
        }
        setExpandedNodes(initialExpanded);
      }
      if (res && res.personalDrive) {
        setPersonalDrive(res.personalDrive);
      }
    } catch (err: any) {
      console.error('Failed to load drive tree:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTreeData();
  }, [currentUser]);

  // Toggle node expand/collapse
  const toggleExpand = (nodeKey: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  };

  // Expand all / collapse all
  const handleExpandAll = () => {
    const allPaths = new Set<string>();
    const collectPaths = (node: FolderNode) => {
      allPaths.add(node.path);
      if (node.children) node.children.forEach(collectPaths);
    };
    if (masterTree) collectPaths(masterTree);
    if (personalDrive?.tree) collectPaths(personalDrive.tree);
    setExpandedNodes(allPaths);
  };

  const handleCollapseAll = () => {
    setExpandedNodes(new Set());
  };

  // Icon helper based on folder name / path
  const getFolderIcon = (name: string, path: string, isPersonal = false) => {
    const lower = `${name} ${path}`.toLowerCase();
    if (isPersonal) return <User className="w-4 h-4 text-amber-500 shrink-0" />;
    if (lower.includes('photo') || lower.includes('still') || lower.includes('raw_photo')) {
      return <Camera className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (lower.includes('video') || lower.includes('footage') || lower.includes('raw videography') || lower.includes('multicam') || lower.includes('stems')) {
      return <Film className="w-4 h-4 text-blue-500 shrink-0" />;
    }
    if (lower.includes('edit') || lower.includes('reel') || lower.includes('deliverable') || lower.includes('review')) {
      return <Scissors className="w-4 h-4 text-purple-500 shrink-0" />;
    }
    if (lower.includes('day 1') || lower.includes('day 2') || lower.includes('day 3')) {
      return <Calendar className="w-4 h-4 text-amber-600 shrink-0" />;
    }
    if (lower.includes('personal') || lower.includes('crew')) {
      return <User className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    return <Folder className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  // Inline Subfolder Creation Handler
  const handleCreateSubfolder = async (parentFolderId: string, parentPath: string) => {
    const name = newSubfolderName.trim();
    if (!name) return;
    try {
      setIsSubmittingSubfolder(true);
      const res = await api.addSubfolder({
        parentId: parentFolderId,
        parentPath: parentPath,
        folderName: name
      });

      notify(`✓ Created subfolder "${name}" in Google Drive!`);
      setAddingSubfolderParentId(null);
      setNewSubfolderName('');

      // Auto-expand parent node
      setExpandedNodes(prev => new Set(prev).add(parentPath));

      // Auto-select this newly created subfolder as active upload target!
      if (res && res.driveFolderId) {
        onSelectFolder(res.driveFolderId, res.path || `${parentPath}/${name}`, activeTab === 'PERSONAL' ? 'PERSONAL' : 'OFFICIAL');
      }

      // Reload full tree to keep in sync
      await loadTreeData();
    } catch (err: any) {
      alert(`Could not create subfolder: ${err.message || err}`);
    } finally {
      setIsSubmittingSubfolder(false);
    }
  };

  // Personal Drive Setup Wizard Submission
  const handleRunSetupWizard = async () => {
    try {
      setIsSettingUpDrive(true);
      const updated = await api.setupPersonalDrive({
        role: wizardRole,
        structureMode: wizardMode,
        customEmail: wizardEmail.trim() || undefined
      });

      setPersonalDrive(updated);
      setShowSetupModal(false);
      setActiveTab('PERSONAL');
      notify(`✓ Successfully configured Personal Google Drive for ${updated.userName}!`);

      // Auto-select personal root or first subfolder
      if (updated.subfolders && updated.subfolders.length > 0) {
        const first = updated.subfolders[0];
        onSelectFolder(first.driveFolderId, first.path, 'PERSONAL');
      } else if (updated.personalRootFolderId) {
        onSelectFolder(updated.personalRootFolderId, updated.personalRootPath, 'PERSONAL');
      }

      await loadTreeData();
    } catch (err: any) {
      alert(`Failed to configure personal drive: ${err.message || err}`);
    } finally {
      setIsSettingUpDrive(false);
    }
  };

  // Personal Subfolder Rename
  const handleRenameSubfolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;
    try {
      const updated = await api.renameMyPersonalFolder(folderId, editingFolderName.trim());
      notify(`✓ Renamed to "${updated.name}"`);
      setEditingFolderId(null);
      setEditingFolderName('');
      await loadTreeData();
    } catch (err: any) {
      alert(`Failed to rename folder: ${err.message}`);
    }
  };

  // Personal Subfolder Delete
  const handleDeleteSubfolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder from Google Drive?')) return;
    try {
      await api.deleteMyPersonalFolder(folderId);
      notify('✓ Folder deleted from Google Drive.');
      await loadTreeData();
    } catch (err: any) {
      alert(`Failed to delete folder: ${err.message}`);
    }
  };

  // Filter tree recursively based on search query
  const filterNode = (node: FolderNode, query: string): FolderNode | null => {
    if (!query) return node;
    const cleanQuery = query.toLowerCase().trim();
    const matchesSelf = node.name.toLowerCase().includes(cleanQuery) || node.path.toLowerCase().includes(cleanQuery);

    const filteredChildren: FolderNode[] = [];
    if (node.children) {
      for (const child of node.children) {
        const matchingChild = filterNode(child, cleanQuery);
        if (matchingChild) {
          filteredChildren.push(matchingChild);
        }
      }
    }

    if (matchesSelf || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren
      };
    }

    return null;
  };

  // Displayed tree depending on active tab & search query
  const displayedTree = useMemo(() => {
    const rawTree = activeTab === 'MASTER' ? masterTree : personalDrive?.tree || null;
    if (!rawTree) return null;
    if (!searchQuery.trim()) return rawTree;
    return filterNode(rawTree, searchQuery);
  }, [activeTab, masterTree, personalDrive, searchQuery]);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: FolderNode, depth = 0, isPersonal = false) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.path) || Boolean(searchQuery.trim());
    const isSelected = selectedFolderId === node.driveFolderId;
    const isAddingSubfolder = addingSubfolderParentId === (node.driveFolderId || node.path);
    const driveUrl = node.driveWebUrl || (node.driveFolderId ? `https://drive.google.com/drive/folders/${node.driveFolderId}` : undefined);

    return (
      <div key={node.path || node.id || node.name} className="select-none">
        {/* Node Row */}
        <div
          className={`group flex items-center justify-between py-1.5 px-2 rounded-xl transition-all cursor-pointer ${
            isSelected
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 font-bold'
              : 'hover:bg-slate-100/80 text-slate-700'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 20 + 8)}px` }}
          onClick={() => {
            if (node.driveFolderId) {
              onSelectFolder(node.driveFolderId, node.path, isPersonal ? 'PERSONAL' : 'OFFICIAL');
            }
          }}
        >
          {/* Left: Chevron + Icon + Name */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.path, e)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                title={isExpanded ? 'Collapse folder' : 'Expand folder'}
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-5" />
            )}

            {getFolderIcon(node.name, node.path, isPersonal)}

            <span className={`text-xs truncate ${isSelected ? 'font-bold text-emerald-900' : 'font-medium'}`}>
              {node.name}
            </span>

            {node.driveFolderId && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline px-1 py-0.2 rounded bg-slate-100">
                ...{node.driveFolderId.slice(-6)}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Active Target Badge or Select Target Button */}
            {isSelected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                <Check className="w-3 h-3" />
                <span>Active Target</span>
              </span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.driveFolderId) {
                    onSelectFolder(node.driveFolderId, node.path, isPersonal ? 'PERSONAL' : 'OFFICIAL');
                  }
                }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-200/80 hover:bg-emerald-600 hover:text-white text-slate-700 transition-colors"
                title="Set as upload target for upcoming files"
              >
                Set Target
              </button>
            )}

            {/* Quick [➕ Subfolder] Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAddingSubfolderParentId(node.driveFolderId || node.path);
                setNewSubfolderName('');
              }}
              className="p-1 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Add a new subfolder inside this folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>

            {/* Direct Open in Google Drive Link */}
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Inline Subfolder Creation Row */}
        {isAddingSubfolder && (
          <div
            className="my-1.5 p-2 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 animate-in fade-in duration-150"
            style={{ marginLeft: `${Math.max(12, depth * 20 + 24)}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 flex-1">
              <FolderPlus className="w-4 h-4 text-blue-600 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={`Subfolder name under "${node.name}" (e.g. Drone Shots, Backstage)...`}
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubfolder(node.driveFolderId || '', node.path);
                  if (e.key === 'Escape') setAddingSubfolderParentId(null);
                }}
                className="w-full text-xs px-2.5 py-1 rounded-lg bg-white border border-blue-300 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 justify-end">
              <button
                onClick={() => handleCreateSubfolder(node.driveFolderId || '', node.path)}
                disabled={isSubmittingSubfolder || !newSubfolderName.trim()}
                className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 flex items-center gap-1"
              >
                {isSubmittingSubfolder ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Creating in Drive...</span>
                  </>
                ) : (
                  <span>Create Subfolder</span>
                )}
              </button>
              <button
                onClick={() => setAddingSubfolderParentId(null)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Render Children if Expanded */}
        {hasChildren && isExpanded && (
          <div className="border-l border-slate-200/60 ml-4">
            {node.children!.map((child) => renderTreeNode(child, depth + 1, isPersonal))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden animate-in fade-in duration-200">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="p-0.5 hover:bg-emerald-700 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-slate-50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Google Drive Hierarchy
            </span>
            <span className="text-xs text-slate-500 font-medium">Interactive Folder Tree</span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-red-600" />
            <span>Select & Organize Upload Destination</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click any folder to set as the active upload target. Click <code className="text-blue-600 font-mono">[➕]</code> to create an instant subfolder on any node.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Personal Drive Wizard Trigger */}
          <button
            onClick={() => {
              setWizardRole((activeRole as UserRole) || 'PHOTOGRAPHER');
              setWizardEmail(currentUser?.email || '');
              setShowSetupModal(true);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all flex items-center gap-1.5"
            title="Configure role-tailored or full event Personal Drive structure"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Configure Personal Drive</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="Close tree view"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs + Search + Tree Expand Buttons */}
      <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Drive Source Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70">
          <button
            onClick={() => setActiveTab('MASTER')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'MASTER'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-red-600" />
            <span>🏛️ SAVISKAR 2026 Master Tree</span>
          </button>
          <button
            onClick={() => setActiveTab('PERSONAL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'PERSONAL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-amber-600" />
            <span>👤 My Personal Drive ({personalDrive?.userName || currentUser?.full_name || 'Crew'})</span>
          </button>
        </div>

        {/* Search & Collapse Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-red-500 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={handleExpandAll}
            className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-200/70"
            title="Expand all folders"
          >
            Expand
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-200/70"
            title="Collapse all folders"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Currently Selected Active Target Header Bar */}
      <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-bold text-emerald-950 shrink-0">Upload Target:</span>
          <span className="font-mono text-emerald-800 truncate" title={selectedFolderPath}>
            {selectedFolderPath || 'SAVISKAR 2026 > Day 1 > Photography'}
          </span>
        </div>
        {selectedFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${selectedFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 hover:underline shrink-0"
          >
            <span>Open in Drive</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Main Folder Tree View */}
      <div className="p-4 max-h-[480px] overflow-y-auto space-y-1">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-red-600" />
            Loading Google Drive hierarchy...
          </div>
        ) : !displayedTree ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No folder matching "{searchQuery}".
          </div>
        ) : (
          renderTreeNode(displayedTree, 0, activeTab === 'PERSONAL')
        )}
      </div>

      {/* Footer Info & Instructions */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700">Legend:</span>
          <span className="inline-flex items-center gap-1"><Camera className="w-3 h-3 text-emerald-600" /> Photography</span>
          <span className="inline-flex items-center gap-1"><Film className="w-3 h-3 text-blue-600" /> 4K Video</span>
          <span className="inline-flex items-center gap-1"><Scissors className="w-3 h-3 text-purple-600" /> Editing</span>
          <span className="inline-flex items-center gap-1"><User className="w-3 h-3 text-amber-600" /> Personal</span>
        </div>
        <div className="text-slate-400">
          Google Drive Root: <code className="font-mono text-slate-600 font-semibold">1PNvblS0BffXR12av3dC7fP7wNdf948kO</code>
        </div>
      </div>

      {/* PERSONAL GOOGLE DRIVE SETUP WIZARD MODAL */}
      <Modal
        isOpen={showSetupModal}
        onClose={() => {
          if (!isSettingUpDrive) setShowSetupModal(false);
        }}
        title="⚡ Configure Your Personal Google Drive Workspace"
        maxWidth="lg"
      >
        <div className="space-y-5 text-xs text-slate-600">
          <div>
            <p className="text-slate-600 leading-relaxed">
              Generate a tailored Google Drive folder structure under your name for SAVISKAR 2026.
              You can choose whether to generate a curated role-specific folder list or the full festival directory.
            </p>
          </div>

          {/* Question 1: Role Selection */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-xs">
              Step 1: Choose Your Media Crew Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setWizardRole('PHOTOGRAPHER')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  wizardRole === 'PHOTOGRAPHER'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>📸 Photographer</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Morning Stills, Rock Concert RAWs, Trophy Lifts & High-Res Selects.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWizardRole('VIDEOGRAPHER')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  wizardRole === 'VIDEOGRAPHER'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Film className="w-4 h-4 text-blue-600" />
                  <span>🎥 Videographer</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  4K B-Roll, Multi-Cam Concert, 120fps Slow-Mo & Soundboard Audio Stems.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWizardRole('VIDEO_EDITOR')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  wizardRole === 'VIDEO_EDITOR'
                    ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Scissors className="w-4 h-4 text-purple-600" />
                  <span>🎬 Video Editor</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Instagram 9:16 Reels, Recap Masters, Project Files & Export Reviews.
                </p>
              </button>
            </div>
          </div>

          {/* Question 2: Google Account / Email */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-xs">
              Step 2: Google Account / Email (For Reference & Notification)
            </label>
            <input
              type="email"
              value={wizardEmail}
              onChange={(e) => setWizardEmail(e.target.value)}
              placeholder="e.g. yourname@gmail.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-red-500 bg-white text-xs font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Personal folders will be created inside the master festival drive under your name and tagged with this email.
            </p>
          </div>

          {/* Question 3: Structure Mode (Role Specific vs Full Event Structure) */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-xs">
              Step 3: Select Directory Structure Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWizardMode('ROLE_SPECIFIC')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                  wizardMode === 'ROLE_SPECIFIC'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-600" />
                    <span>Role-Tailored Event List</span>
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Creates 5 curated, role-specific event subfolders for SAVISKAR 2026. Super clear, minimal, and fast to navigate during live shooting.
                </p>
                <div className="mt-1 p-2 rounded-lg bg-white border border-amber-200/80 text-[10px] text-slate-600 space-y-0.5 font-mono">
                  <div>📁 01 - Day 1 Morning</div>
                  <div>📁 02 - Day 1 Evening Rock Concert</div>
                  <div>📁 03 - Day 2 Tech Arena</div>
                  <div>📁 04 - Day 2 Valedictory</div>
                  <div>📁 05 - Highlights & Selects</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setWizardMode('FULL_EVENT')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                  wizardMode === 'FULL_EVENT'
                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Full Festival Directory</span>
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900">
                    Full Archive
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Creates the complete 9-folder festival tree under your name (Day 1, Day 2, Day 3, Social Media Reels, Branding). Ideal for multi-disciplinary crew.
                </p>
                <div className="mt-1 p-2 rounded-lg bg-white border border-indigo-200/80 text-[10px] text-slate-600 space-y-0.5 font-mono">
                  <div>📁 Day 1 - Photography & Video</div>
                  <div>📁 Day 2 - Photography & Video</div>
                  <div>📁 Day 3 - Valedictory & Awards</div>
                  <div>📁 Social Media Reels (9-16)</div>
                  <div>📁 Master Branding & Logos</div>
                </div>
              </button>
            </div>
          </div>

          {/* Submission Button */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSettingUpDrive}
              onClick={() => setShowSetupModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSettingUpDrive}
              onClick={handleRunSetupWizard}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-xs flex items-center gap-2"
            >
              {isSettingUpDrive ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Provisioning Google Drive...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>⚡ Build My Google Drive Structure</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
