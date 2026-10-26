import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { FolderNode, PersonalDriveInfo, UserRole } from '../../types';
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
  Mail,
  X
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
  const [toastLink, setToastLink] = useState<string | null>(null);

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

  // Show temporary toast notification
  const notify = (msg: string, link?: string) => {
    setToastMessage(msg);
    setToastLink(link || null);
    setTimeout(() => {
      setToastMessage('');
      setToastLink(null);
    }, 6000);
  };

  // Fetch unified tree and personal drive
  const loadTreeData = async () => {
    try {
      setIsLoading(true);
      const res = await api.getDriveTree();
      if (res && res.masterTree) {
        setMasterTree(res.masterTree);
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
    if (isPersonal) return <User className="w-4 h-4 text-slate-700 shrink-0" />;
    if (lower.includes('photo') || lower.includes('still') || lower.includes('raw_photo')) {
      return <Camera className="w-4 h-4 text-red-600 shrink-0" />;
    }
    if (lower.includes('video') || lower.includes('footage') || lower.includes('raw videography') || lower.includes('multicam') || lower.includes('stems')) {
      return <Film className="w-4 h-4 text-red-600 shrink-0" />;
    }
    if (lower.includes('edit') || lower.includes('reel') || lower.includes('deliverable') || lower.includes('review')) {
      return <Scissors className="w-4 h-4 text-slate-700 shrink-0" />;
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

      notify(`Subfolder "${name}" created on Google Drive!`, res?.driveWebUrl);
      setAddingSubfolderParentId(null);
      setNewSubfolderName('');

      // Auto-expand parent node
      setExpandedNodes(prev => new Set(prev).add(parentPath));

      // Auto-select this newly created subfolder as active upload target
      if (res && res.driveFolderId) {
        onSelectFolder(res.driveFolderId, res.path || `${parentPath}/${name}`, activeTab === 'PERSONAL' ? 'PERSONAL' : 'OFFICIAL');
      }

      await loadTreeData();
    } catch (err: any) {
      alert(`Could not create subfolder: ${err.message || err}`);
    } finally {
      setIsSubmittingSubfolder(false);
    }
  };

  // Personal Drive Setup Wizard Submission
  const handleRunSetupWizard = async () => {
    const emailToShare = wizardEmail.trim().toLowerCase();
    try {
      setIsSettingUpDrive(true);
      const updated = await api.setupPersonalDrive({
        role: wizardRole,
        structureMode: wizardMode,
        customEmail: emailToShare || undefined
      });

      setPersonalDrive(updated);
      setShowSetupModal(false);
      setActiveTab('PERSONAL');

      const shareNotice = emailToShare
        ? `Shared directly with your Gmail (${emailToShare}). Check Google Drive under "Shared with me"!`
        : `Personal Drive created!`;
      notify(shareNotice, updated.personalRootFolderUrl);

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
        {/* Spacious Node Row */}
        <div
          className={`group flex items-center justify-between py-2.5 px-3 rounded-xl transition-all cursor-pointer border ${
            isSelected
              ? 'bg-red-50/70 border-red-300 text-slate-900 font-semibold'
              : 'border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700'
          }`}
          style={{ paddingLeft: `${Math.max(12, depth * 24 + 12)}px` }}
          onClick={() => {
            if (node.driveFolderId) {
              onSelectFolder(node.driveFolderId, node.path, isPersonal ? 'PERSONAL' : 'OFFICIAL');
            }
          }}
        >
          {/* Left: Chevron + Icon + Folder Name */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.path, e)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
            ) : (
              <span className="w-6" />
            )}

            {getFolderIcon(node.name, node.path, isPersonal)}

            <span className={`text-sm truncate ${isSelected ? 'font-bold text-red-950' : 'font-medium text-slate-800'}`}>
              {node.name}
            </span>
          </div>

          {/* Right: Actions with proper spacing */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Active Target Indicator / Button */}
            {isSelected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white shadow-2xs">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Selected Target</span>
              </span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.driveFolderId) {
                    onSelectFolder(node.driveFolderId, node.path, isPersonal ? 'PERSONAL' : 'OFFICIAL');
                  }
                }}
                className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:border-red-500 hover:text-red-600 transition-colors"
              >
                Select Target
              </button>
            )}

            {/* Subfolder Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAddingSubfolderParentId(node.driveFolderId || node.path);
                setNewSubfolderName('');
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
              title="Add subfolder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>

            {/* Open in Drive Link */}
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Inline Subfolder Creation Row with comfortable spacing */}
        {isAddingSubfolder && (
          <div
            className="my-2 p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 animate-fade-in"
            style={{ marginLeft: `${Math.max(16, depth * 24 + 32)}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 flex-1">
              <FolderPlus className="w-4 h-4 text-red-600 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={`Subfolder name under "${node.name}"...`}
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSubfolder(node.driveFolderId || '', node.path);
                  if (e.key === 'Escape') setAddingSubfolderParentId(null);
                }}
                className="w-full text-xs px-3 py-2 rounded-lg bg-white border border-slate-300 focus:outline-hidden focus:border-red-600"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0 justify-end">
              <button
                onClick={() => handleCreateSubfolder(node.driveFolderId || '', node.path)}
                disabled={isSubmittingSubfolder || !newSubfolderName.trim()}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingSubfolder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Add Subfolder</span>
                )}
              </button>
              <button
                onClick={() => setAddingSubfolderParentId(null)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Children Rows */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-slate-100 ml-5 my-0.5 space-y-0.5">
            {node.children!.map((child) => renderTreeNode(child, depth + 1, isPersonal))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="bg-slate-900 text-white px-5 py-3 text-xs font-medium flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 truncate">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {toastLink && (
              <a
                href={toastLink}
                target="_blank"
                rel="noreferrer"
                className="text-red-400 hover:text-red-300 font-bold underline inline-flex items-center gap-1"
              >
                <span>Open in Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button onClick={() => setToastMessage('')} className="p-1 hover:bg-slate-800 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header with clean spacing and Red & White Theme */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Destination Selector
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-red-600" />
            <span>Google Drive Folder Hierarchy</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Click any folder to set as upload destination. Click the subfolder icon to create folders inside.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setWizardRole((activeRole as UserRole) || 'PHOTOGRAPHER');
              setWizardEmail(currentUser?.email || '');
              setShowSetupModal(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>Connect / Setup Gmail Drive</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher Tabs + Search with clean layout */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Drive Source Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-slate-200">
          <button
            onClick={() => setActiveTab('MASTER')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'MASTER'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            SAVISKAR Official Folders
          </button>
          <button
            onClick={() => setActiveTab('PERSONAL')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'PERSONAL'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            My Personal Drive {personalDrive?.sharedWithEmail ? `(${personalDrive.sharedWithEmail})` : ''}
          </button>
        </div>

        {/* Search & Collapse Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-8 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:border-red-600 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleExpandAll}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Currently Selected Active Target Header Bar */}
      <div className="px-5 py-3 bg-red-50/60 border-b border-red-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
          <span className="font-bold text-slate-900 shrink-0">Upload Target:</span>
          <span className="font-semibold text-red-950 truncate" title={selectedFolderPath}>
            {selectedFolderPath || 'SAVISKAR 2026 > Day 1 > Photography'}
          </span>
        </div>
        {selectedFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${selectedFolderId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800 hover:underline shrink-0"
          >
            <span>Open in Drive</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Main Folder Tree View with proper breathing room */}
      <div className="p-4 sm:p-5 max-h-[500px] overflow-y-auto space-y-1">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
            Loading Google Drive hierarchy...
          </div>
        ) : !displayedTree ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No folders found matching "{searchQuery}".
          </div>
        ) : (
          renderTreeNode(displayedTree, 0, activeTab === 'PERSONAL')
        )}
      </div>

      {/* PERSONAL GOOGLE DRIVE SETUP WIZARD MODAL */}
      <Modal
        isOpen={showSetupModal}
        onClose={() => {
          if (!isSettingUpDrive) setShowSetupModal(false);
        }}
        title="Configure & Share Google Drive"
        maxWidth="lg"
      >
        <div className="space-y-6 text-xs text-slate-700 p-1">
          <div>
            <p className="text-slate-600 leading-relaxed text-sm">
              Enter your Gmail address below. We will automatically create your personal folder structure on Google Drive and <strong>share it directly to your Gmail account as an Editor</strong>. You'll see it under <strong>"Shared with me"</strong> on your Google Drive.
            </p>
          </div>

          {/* Question 1: Role Selection */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-900 block text-xs">
              1. Choose Your Media Role
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setWizardRole('PHOTOGRAPHER')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  wizardRole === 'PHOTOGRAPHER'
                    ? 'bg-red-50/70 border-red-500 ring-2 ring-red-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Camera className="w-4 h-4 text-red-600" />
                  <span>Photographer</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  RAWs, Stills, Highlights & Selects
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWizardRole('VIDEOGRAPHER')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  wizardRole === 'VIDEOGRAPHER'
                    ? 'bg-red-50/70 border-red-500 ring-2 ring-red-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Film className="w-4 h-4 text-red-600" />
                  <span>Videographer</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  4K Footage, Multi-Cam & Audio Stems
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWizardRole('VIDEO_EDITOR')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                  wizardRole === 'VIDEO_EDITOR'
                    ? 'bg-red-50/70 border-red-500 ring-2 ring-red-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                  <Scissors className="w-4 h-4 text-red-600" />
                  <span>Video Editor</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  9:16 Reels, Recap Masters & Projects
                </p>
              </button>
            </div>
          </div>

          {/* Question 2: Gmail Address to Share Drive */}
          <div className="space-y-2">
            <label className="font-bold text-slate-900 block text-xs">
              2. Your Gmail Address (Drive will be shared to this account)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={wizardEmail}
                onChange={(e) => setWizardEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:border-red-600 bg-white text-xs font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              ✓ Google Drive will invite this Gmail as an Editor so the folders immediately appear in your Drive.
            </p>
          </div>

          {/* Question 3: Structure Mode */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-900 block text-xs">
              3. Folder Structure Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWizardMode('ROLE_SPECIFIC')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                  wizardMode === 'ROLE_SPECIFIC'
                    ? 'bg-red-50/70 border-red-500 ring-2 ring-red-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">
                    Role-Tailored List
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  5 clean event folders specific to your role. Keeps your drive neat and focused.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWizardMode('FULL_EVENT')}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                  wizardMode === 'FULL_EVENT'
                    ? 'bg-red-50/70 border-red-500 ring-2 ring-red-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">
                    Full Festival Archive
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Full 9-folder festival directory (Day 1, Day 2, Day 3, Reels, Branding).
                </p>
              </button>
            </div>
          </div>

          {/* Submission Button */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSettingUpDrive}
              onClick={() => setShowSetupModal(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSettingUpDrive || !wizardEmail.trim()}
              onClick={handleRunSetupWizard}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-2xs flex items-center gap-2 transition-colors"
            >
              {isSettingUpDrive ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sharing to your Gmail Drive...</span>
                </>
              ) : (
                <span>Create & Share to My Gmail</span>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
