import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MemberDrive, MediaAsset, UserRole } from '../types';
import {
  HardDrive,
  CheckCircle,
  FolderTree,
  FolderOpen,
  FolderPlus,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  Link as LinkIcon,
  AlertTriangle,
  LogOut,
  Edit3,
  Trash2,
  Plus,
  Info,
  ChevronRight,
  ChevronDown,
  Users,
  Camera,
  Film,
  Scissors,
  ArrowRightLeft,
  Search,
  Mail,
  Share2,
  FolderCheck,
  Sparkles,
  Layers,
  X,
  Lock,
  Shield,
  Eye
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export const DriveSettingsPage: React.FC = () => {
  const { isCoordinator, isSuperAdmin, isPresident } = useAuth();
  const hasAdminAccess = isCoordinator || isSuperAdmin || isPresident;

  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [authData, setAuthData] = useState<any>(null);
  const [structure, setStructure] = useState<any>(null);
  const [flatList, setFlatList] = useState<any[]>([]);
  const [provisionMessage, setProvisionMessage] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [testUrl, setTestUrl] = useState('https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO');
  const [urlValidationResult, setUrlValidationResult] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'MEMBER_DRIVES' | 'MASTER_HIERARCHY' | 'DATA_TRANSFER'>('MEMBER_DRIVES');

  // Member Drives State
  const [memberDrives, setMemberDrives] = useState<MemberDrive[]>([]);
  const [isLoadingMemberDrives, setIsLoadingMemberDrives] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('ALL');

  // Create Member Drive Modal State
  const [showCreateMemberModal, setShowCreateMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole | 'VLOGGER'>('PHOTOGRAPHER');
  const [newMemberAccessLevel, setNewMemberAccessLevel] = useState<'reader' | 'writer'>('writer');
  const [isCreatingMemberDrive, setIsCreatingMemberDrive] = useState(false);

  // Permission Delegation Modal State (Super Admin & Admin Only)
  const [managingPermissionDrive, setManagingPermissionDrive] = useState<MemberDrive | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [targetPermEmail, setTargetPermEmail] = useState('');
  const [targetPermName, setTargetPermName] = useState('');
  const [targetPermRole, setTargetPermRole] = useState<'reader' | 'writer'>('reader');
  const [isGrantingPerm, setIsGrantingPerm] = useState(false);
  const [revokingPermEmail, setRevokingPermEmail] = useState<string | null>(null);
  const [togglingAccessDriveId, setTogglingAccessDriveId] = useState<string | null>(null);
  const [crewUsers, setCrewUsers] = useState<any[]>([]);

  // Inspect / Edit Subfolders Modal State
  const [inspectingDrive, setInspectingDrive] = useState<MemberDrive | null>(null);
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [newSubfolderInput, setNewSubfolderInput] = useState('');
  const [isAddingSubfolder, setIsAddingSubfolder] = useState(false);
  const [renamingSubfolderId, setRenamingSubfolderId] = useState<string | null>(null);
  const [renameSubfolderValue, setRenameSubfolderValue] = useState('');
  const [isRenamingSubfolder, setIsRenamingSubfolder] = useState(false);

  // Master Folder management state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentPath, setAddParentPath] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Rename master folder state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ path: string; name: string } | null>(null);
  const [newRenameValue, setNewRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Data Transfer Engine State
  const [availableAssets, setAvailableAssets] = useState<MediaAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [transferTargetFolderId, setTransferTargetFolderId] = useState('');
  const [transferTargetFolderPath, setTransferTargetFolderPath] = useState('');
  const [transferNewCategory, setTransferNewCategory] = useState<string>('RAW_VIDEO');
  const [transferFilterType, setTransferFilterType] = useState<string>('ALL');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferSuccessBanner, setTransferSuccessBanner] = useState<string | null>(null);

  // Collapsed paths
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  const toggleCollapse = (path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const loadData = async () => {
    try {
      const [status, structRes, authRes, drivesRes, assetsRes, usersRes] = await Promise.all([
        api.getDriveStatus(),
        api.getDriveFolderStructure().catch(() => ({ structure: null, flatList: [] })),
        api.getDriveAuthUrl().catch(() => ({ authUrl: '', isConfigured: false })),
        api.getMemberDrives().catch(() => []),
        api.getMediaAssets().catch(() => []),
        api.getUsers().catch(() => [])
      ]);
      setDriveStatus(status);
      setStructure(structRes.structure);
      setFlatList(structRes.flatList || []);
      setAuthData(authRes);
      setMemberDrives(drivesRes);
      setAvailableAssets(assetsRes);
      setCrewUsers(usersRes || []);
      if (structRes.structure && !addParentPath) {
        setAddParentPath(structRes.structure.path);
      }
    } catch (err) {
      console.error('Failed to load drive settings', err);
    }
  };

  const loadMemberDrives = async () => {
    try {
      setIsLoadingMemberDrives(true);
      const data = await api.getMemberDrives();
      setMemberDrives(data);
    } catch (err) {
      console.error('Failed to load member drives', err);
    } finally {
      setIsLoadingMemberDrives(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncAll = async () => {
    if (!driveStatus?.isConnected) {
      alert('Please connect your Google Drive account first before syncing folders.');
      return;
    }
    try {
      setIsSyncing(true);
      setProvisionMessage('');
      const res = await api.syncDriveFolders();
      setProvisionMessage(res.message || `Successfully synced folders directly into Google Drive.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Folder sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Create Member Drive Handler
  const handleCreateMemberDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newMemberEmail.trim().toLowerCase();
    const name = newMemberName.trim();

    if (!email || !name) {
      alert('Please provide member name and Gmail address.');
      return;
    }

    try {
      setIsCreatingMemberDrive(true);
      const created = await api.createMemberDrive({
        memberEmail: email,
        memberName: name,
        role: newMemberRole,
        accessLevel: newMemberAccessLevel
      });

      setShowCreateMemberModal(false);
      setNewMemberEmail('');
      setNewMemberName('');
      setNewMemberAccessLevel('writer');
      setProvisionMessage(
        `Created ${created.specializationLabel} Google Drive for ${name} (${email})! Shared as ${created.accessLevel === 'reader' ? 'Download Only (Viewer)' : 'Editor'} in Google Drive.`
      );
      await loadMemberDrives();
    } catch (err: any) {
      alert(`Could not create drive: ${err.message || err}`);
    } finally {
      setIsCreatingMemberDrive(false);
    }
  };

  // Permission Management Handlers (Super Admin & Admin Only)
  const handleOpenPermissionModal = (drive: MemberDrive) => {
    setManagingPermissionDrive(drive);
    setTargetPermEmail('');
    setTargetPermName('');
    setTargetPermRole('reader'); // Default to Download Only
    setShowPermissionModal(true);
  };

  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingPermissionDrive) return;

    const email = targetPermEmail.trim().toLowerCase();
    const name = targetPermName.trim() || email.split('@')[0];

    if (!email || !email.includes('@')) {
      alert('Please enter a valid Gmail address to grant access.');
      return;
    }

    try {
      setIsGrantingPerm(true);
      const updatedDrive = await api.grantDriveAccess(managingPermissionDrive.id, {
        email,
        name,
        role: targetPermRole
      });

      setManagingPermissionDrive(updatedDrive);
      const updatedList = await api.getMemberDrives();
      setMemberDrives(updatedList);

      setTargetPermEmail('');
      setTargetPermName('');
      setProvisionMessage(
        `Granted "${targetPermRole === 'reader' ? 'Download Only (Viewer)' : 'Full Editor'}" access to ${name} (${email}) on ${updatedDrive.memberName}'s Google Drive!`
      );
    } catch (err: any) {
      alert(`Failed to grant permission: ${err.message || err}`);
    } finally {
      setIsGrantingPerm(false);
    }
  };

  const handleRevokePermission = async (targetEmail: string) => {
    if (!managingPermissionDrive) return;
    if (!window.confirm(`Revoke Google Drive access for ${targetEmail}?`)) return;

    try {
      setRevokingPermEmail(targetEmail);
      const updatedDrive = await api.revokeDriveAccess(managingPermissionDrive.id, targetEmail);
      setManagingPermissionDrive(updatedDrive);

      const updatedList = await api.getMemberDrives();
      setMemberDrives(updatedList);

      setProvisionMessage(`Revoked access for ${targetEmail} from ${updatedDrive.memberName}'s drive.`);
    } catch (err: any) {
      alert(`Failed to revoke access: ${err.message || err}`);
    } finally {
      setRevokingPermEmail(null);
    }
  };

  const handleToggleAccessLevel = async (drive: MemberDrive) => {
    const nextLevel: 'reader' | 'writer' = drive.accessLevel === 'reader' ? 'writer' : 'reader';
    const nextLabel = nextLevel === 'reader' ? 'Download Only (Viewer)' : 'Full Editor';

    try {
      setTogglingAccessDriveId(drive.id);
      const updated = await api.updateDriveAccessLevel(drive.id, nextLevel);

      const updatedList = await api.getMemberDrives();
      setMemberDrives(updatedList);
      if (inspectingDrive?.id === drive.id) setInspectingDrive(updated);
      if (managingPermissionDrive?.id === drive.id) setManagingPermissionDrive(updated);

      setProvisionMessage(
        `Updated primary access for ${drive.memberName} (${drive.memberEmail}) to ${nextLabel}.`
      );
    } catch (err: any) {
      alert(`Failed to update access level: ${err.message || err}`);
    } finally {
      setTogglingAccessDriveId(null);
    }
  };

  const [isDeletingDriveId, setIsDeletingDriveId] = useState<string | null>(null);

  const handleDeleteMemberDrive = async (drive: MemberDrive) => {
    if (!window.confirm(`Are you sure you want to remove ${drive.memberName}'s drive (${drive.memberEmail}) from Drive Studio?`)) {
      return;
    }

    try {
      setIsDeletingDriveId(drive.id);
      await api.deleteMemberDrive(drive.id);
      setMemberDrives(prev => prev.filter(d => d.id !== drive.id && d.memberEmail.toLowerCase() !== drive.memberEmail.toLowerCase()));
      setProvisionMessage(`Removed ${drive.memberName}'s drive from Drive Studio.`);
    } catch (err: any) {
      alert(`Failed to remove drive: ${err.message || err}`);
    } finally {
      setIsDeletingDriveId(null);
    }
  };

  // Inspect Subfolders
  const handleOpenInspectModal = (drive: MemberDrive) => {
    setInspectingDrive(drive);
    setNewSubfolderInput('');
    setRenamingSubfolderId(null);
    setShowInspectModal(true);
  };

  // Add Subfolder to Member Drive
  const handleAddSubfolderToMemberDrive = async () => {
    if (!inspectingDrive || !newSubfolderInput.trim()) return;
    try {
      setIsAddingSubfolder(true);
      const sub = await api.addMemberDriveSubfolder(
        inspectingDrive.id,
        newSubfolderInput.trim(),
        inspectingDrive.driveFolderId
      );

      // Refresh local inspectingDrive state
      const updatedList = await api.getMemberDrives();
      setMemberDrives(updatedList);
      const updatedDrive = updatedList.find(d => d.id === inspectingDrive.id);
      if (updatedDrive) setInspectingDrive(updatedDrive);

      setNewSubfolderInput('');
      setProvisionMessage(`Added subfolder "${sub.name}" to ${inspectingDrive.memberName}'s drive.`);
    } catch (err: any) {
      alert(`Failed to add subfolder: ${err.message || err}`);
    } finally {
      setIsAddingSubfolder(false);
    }
  };

  // Rename Subfolder in Member Drive
  const handleRenameSubfolderInMemberDrive = async (subfolderId: string) => {
    if (!inspectingDrive || !renameSubfolderValue.trim()) return;
    try {
      setIsRenamingSubfolder(true);
      await api.renameMemberDriveFolder(inspectingDrive.id, subfolderId, renameSubfolderValue.trim());

      const updatedList = await api.getMemberDrives();
      setMemberDrives(updatedList);
      const updatedDrive = updatedList.find(d => d.id === inspectingDrive.id);
      if (updatedDrive) setInspectingDrive(updatedDrive);

      setRenamingSubfolderId(null);
      setRenameSubfolderValue('');
      setProvisionMessage(`Folder renamed to "${renameSubfolderValue.trim()}".`);
    } catch (err: any) {
      alert(`Failed to rename subfolder: ${err.message || err}`);
    } finally {
      setIsRenamingSubfolder(false);
    }
  };

  // Delete Subfolder in Member Drive
  const handleDeleteSubfolderInMemberDrive = async (subfolderId: string, subfolderName: string) => {
    if (!inspectingDrive) return;
    if (!window.confirm(`Delete "${subfolderName}" from ${inspectingDrive.memberName}'s Google Drive?`)) return;

    try {
      await api.deleteMemberDriveFolder(inspectingDrive.id, subfolderId);
      const updatedList = await api.getMemberDrives();
      setMemberDrives(updatedList);
      const updatedDrive = updatedList.find(d => d.id === inspectingDrive.id);
      if (updatedDrive) setInspectingDrive(updatedDrive);

      setProvisionMessage(`Removed folder "${subfolderName}" from drive.`);
    } catch (err: any) {
      alert(`Failed to delete subfolder: ${err.message || err}`);
    }
  };

  // Data Transfer Execution
  const handleExecuteDataTransfer = async () => {
    if (!transferTargetFolderId) {
      alert('Please select a target destination folder (e.g. Vlogging folder).');
      return;
    }
    if (selectedAssetIds.length === 0) {
      alert('Please select at least one media asset to transfer.');
      return;
    }

    try {
      setIsTransferring(true);
      setTransferSuccessBanner(null);

      const res = await api.transferMediaData({
        assetIds: selectedAssetIds,
        targetFolderId: transferTargetFolderId,
        targetFolderPath: transferTargetFolderPath || 'Google Drive Destination',
        newCategory: transferNewCategory
      });

      setTransferSuccessBanner(
        `Transferred ${res.transferredCount} items directly into "${transferTargetFolderPath || 'Target Folder'}" on Google Drive!`
      );
      setSelectedAssetIds([]);
      await loadData();
    } catch (err: any) {
      alert(`Data transfer failed: ${err.message || err}`);
    } finally {
      setIsTransferring(false);
    }
  };

  // Quick Preset Transfer to Vlogging
  const handleQuickTransferToVlogging = (day: 1 | 2) => {
    const vloggingDriveId = day === 1 ? '1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ' : '1LF1A9AbGiWyQlYKT0V0v7LH3OPCcBGUF';
    const vloggingPath = `/DSA MEDIAVERSE SAVISKAR 26/Day ${day}/Raw Videography`;
    setTransferTargetFolderId(vloggingDriveId);
    setTransferTargetFolderPath(vloggingPath);
    setTransferNewCategory('RAW_VIDEO');
    setActiveTab('DATA_TRANSFER');
    setProvisionMessage(`Target set to Day ${day} Vlogging & Videography. Select assets below to transfer.`);
  };

  const handleOpenAddModal = (parentPath?: string) => {
    setAddParentPath(parentPath || structure?.path || '/DSA MEDIAVERSE SAVISKAR 26');
    setNewFolderName('');
    setShowAddModal(true);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !addParentPath) return;

    try {
      setIsAdding(true);
      await api.addDriveFolder(addParentPath, newFolderName.trim());
      setShowAddModal(false);
      setNewFolderName('');
      setProvisionMessage(`Folder "${newFolderName.trim()}" created successfully!`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create folder');
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenRenameModal = (node: any) => {
    setRenameTarget({ path: node.path, name: node.name });
    setNewRenameValue(node.name);
    setShowRenameModal(true);
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newRenameValue.trim()) return;

    try {
      setIsRenaming(true);
      await api.renameDriveFolder(renameTarget.path, newRenameValue.trim());
      setShowRenameModal(false);
      setRenameTarget(null);
      setProvisionMessage(`Folder renamed to "${newRenameValue.trim()}"`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to rename folder');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteFolder = async (node: any) => {
    if (!window.confirm(`Are you sure you want to remove folder "${node.name}" and any subfolders?`)) {
      return;
    }

    try {
      await api.deleteDriveFolder(node.path);
      setProvisionMessage(`Folder "${node.name}" removed from active hierarchy.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete folder');
    }
  };

  const handleResetStructure = async () => {
    if (!window.confirm('Reset the Google Drive structure back to the official SAVISKAR 2026 master hierarchy? Custom added folders will be reset.')) {
      return;
    }

    try {
      await api.resetDriveStructure();
      setProvisionMessage('Google Drive hierarchy reset to official SAVISKAR 2026 default.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reset structure');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect Google Drive? Media uploads will require re-authorization.')) return;
    try {
      await api.disconnectDrive();
      setProvisionMessage('Google Drive disconnected successfully.');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Disconnect failed');
    }
  };

  const handleValidateUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl.trim()) return;
    try {
      const res = await fetch('/api/v1/drive/validate-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('mediaverse_auth_token') || ''}`,
          'x-user-id': localStorage.getItem('mediaverse_active_user_id') || ''
        },
        body: JSON.stringify({ url: testUrl })
      });
      const data = await res.json();
      setUrlValidationResult(data.data);
    } catch (err) {
      console.error('Validation error', err);
    }
  };

  const handleCopyRootLink = () => {
    const rootUrl = driveStatus?.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO';
    navigator.clipboard.writeText(rootUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMemberEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Filtered member drives
  const filteredMemberDrives = memberDrives.filter(drive => {
    const matchesSearch =
      drive.memberName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      drive.memberEmail.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      drive.specializationLabel.toLowerCase().includes(memberSearchQuery.toLowerCase());
    const matchesRole = memberRoleFilter === 'ALL' || drive.role === memberRoleFilter;
    return matchesSearch && matchesRole;
  });

  // Filtered transfer assets
  const filteredTransferAssets = availableAssets.filter(asset => {
    if (transferFilterType === 'ALL') return true;
    return asset.media_type === transferFilterType;
  });

  // Recursive tree renderer for Master Hierarchy
  const renderTree = (node: any, depth = 0) => {
    if (!node) return null;
    const isRoot = depth === 0;
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isCollapsed = collapsedPaths.has(node.path);

    const folderDriveUrl = node.driveWebUrl || (node.driveFolderId ? `https://drive.google.com/drive/folders/${node.driveFolderId}` : null);

    return (
      <div key={node.path} className="space-y-1.5" style={{ paddingLeft: `${depth * 22}px` }}>
        <div className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 px-3.5 rounded-xl border transition-all ${
          isRoot
            ? 'bg-red-50/70 border-red-200 shadow-2xs'
            : 'bg-white hover:bg-slate-50/80 border-slate-200/90 shadow-2xs'
        }`}>
          {/* Left: Expand, Folder Icon, Name & Path */}
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => toggleCollapse(node.path)}
                className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded transition-colors"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-5 h-5" />
            )}

            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isRoot
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              <FolderOpen className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold truncate ${isRoot ? 'text-red-950 font-mono text-sm' : 'text-slate-900'}`}>
                  {node.name}
                </span>

                {folderDriveUrl ? (
                  <a
                    href={folderDriveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    title={`Google Drive Folder ID: ${node.driveFolderId}`}
                  >
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    <span>In Google Drive</span>
                    <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-70" />
                  </a>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Pending Sync
                  </span>
                )}
              </div>

              <p className="text-[10px] text-slate-500 font-mono truncate mt-0.5">
                {node.path}
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 pt-1 sm:pt-0">
            {folderDriveUrl && (
              <a
                href={folderDriveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Open this folder directly in Google Drive"
              >
                <span>Open Folder</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            )}

            <button
              onClick={() => handleOpenAddModal(node.path)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 transition-colors"
              title="Add a subfolder under this directory"
            >
              <Plus className="w-3 h-3" />
              <span>Subfolder</span>
            </button>

            {!isRoot && (
              <>
                <button
                  onClick={() => handleOpenRenameModal(node)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Rename folder"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDeleteFolder(node)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete folder from hierarchy"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Children */}
        {!isCollapsed && hasChildren && (
          <div className="space-y-1.5 pt-1">
            {node.children.map((child: any) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootUrl = driveStatus?.rootFolderUrl || 'https://drive.google.com/drive/folders/1PNvblS0BffXR12av3dC7fP7wNdf948kO';
  const rootId = driveStatus?.rootFolderId || '1PNvblS0BffXR12av3dC7fP7wNdf948kO';
  const isConnected = Boolean(driveStatus?.isConnected);

  if (!hasAdminAccess) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 animate-fade-in">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 uppercase tracking-wider">
              Restricted Area
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight pt-2">
              Super Admin & Coordinator Access Only
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Drive Studio, role-specific cloud storage provisioning, and Google Drive access delegation are reserved exclusively for Media Coordinators and Super Admins.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 max-w-md mx-auto text-left space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-red-600" />
              <span>Looking for your personal drive?</span>
            </div>
            <p className="text-slate-500">
              Your role-tailored Google Drive folders and upload destinations are always accessible directly inside the Field Crew Portal.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/field-crew"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition-all"
            >
              <span>Go to Field Crew Portal</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Super Admin Console
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026 Production Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Google Drive & Member Hierarchy Studio
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Create tailored Google Drives for any member's Gmail, transfer camera footage into vlogging/editing, and update folder trees in depth.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-auto flex-wrap">
          <button
            onClick={() => setShowCreateMemberModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>+ Create Member Drive</span>
          </button>

          <button
            onClick={() => setActiveTab('DATA_TRANSFER')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4 text-red-600" />
            <span>Transfer Data Engine</span>
          </button>

          <a
            href={rootUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Master Drive</span>
          </a>
        </div>
      </div>

      {provisionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-semibold">{provisionMessage}</span>
          </div>
          <button
            onClick={() => setProvisionMessage('')}
            className="text-[11px] font-bold text-emerald-900 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('MEMBER_DRIVES')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
            activeTab === 'MEMBER_DRIVES'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Member Gmail Drives Directory</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-800 font-bold">
            {memberDrives.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('MASTER_HIERARCHY')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
            activeTab === 'MASTER_HIERARCHY'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Master SAVISKAR 2026 Hierarchy</span>
        </button>

        <button
          onClick={() => setActiveTab('DATA_TRANSFER')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 shrink-0 ${
            activeTab === 'DATA_TRANSFER'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Data & Media Transfer Studio</span>
        </button>
      </div>

      {/* ================================================= */}
      {/* TAB 1: MEMBER GMAIL DRIVES DIRECTORY */}
      {/* ================================================= */}
      {activeTab === 'MEMBER_DRIVES' && (
        <div className="space-y-5 animate-fade-in">
          {/* Explainer card */}
          <div className="p-4 rounded-xl bg-slate-900 text-white text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Super Admin Gmail-Wise Drive Controller</h4>
                <p className="text-slate-300 text-xs mt-0.5">
                  Each drive created here is automatically shared directly with that member's Gmail address as an Editor in Google Drive. Photography drives strictly contain only photography folders.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateMemberModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shrink-0"
            >
              + Add Member Gmail Drive
            </button>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by member Gmail, name, or specialization..."
                value={memberSearchQuery}
                onChange={e => setMemberSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={memberRoleFilter}
                onChange={e => setMemberRoleFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
              >
                <option value="ALL">All Departments</option>
                <option value="PHOTOGRAPHER">Photography Only</option>
                <option value="VIDEOGRAPHER">Videography / Vlogging</option>
                <option value="VIDEO_EDITOR">Video Editing</option>
              </select>
            </div>
          </div>

          {/* Member Drives Grid */}
          {isLoadingMemberDrives ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading member drives...</div>
          ) : filteredMemberDrives.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-8 text-xs text-slate-500">
              No member drives found matching your query. Click "+ Create Member Drive" to provision one!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMemberDrives.map(drive => {
                const isPhoto = drive.role === 'PHOTOGRAPHER';
                const isVideo = drive.role === 'VIDEOGRAPHER' || (drive.role as string) === 'VLOGGER';
                const isEditor = drive.role === 'VIDEO_EDITOR';

                return (
                  <div
                    key={drive.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-card hover:border-red-200 hover:shadow-card-hover transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPhoto
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : isVideo
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : isEditor
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {isPhoto ? <Camera className="w-3 h-3" /> : isVideo ? <Film className="w-3 h-3" /> : <Scissors className="w-3 h-3" />}
                          <span>{drive.role}</span>
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() => handleToggleAccessLevel(drive)}
                            disabled={togglingAccessDriveId === drive.id}
                            title="Click to toggle: Download Only vs Full Editor"
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                              drive.accessLevel === 'reader'
                                ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300'
                                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                            }`}
                          >
                            {drive.accessLevel === 'reader' ? (
                              <>
                                <Eye className="w-3 h-3 text-amber-600" />
                                <span>Download Only 👁️</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Full Editor ✍️</span>
                              </>
                            )}
                          </button>

                          {drive.grantedPermissions && drive.grantedPermissions.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                              <Shield className="w-2.5 h-2.5 text-indigo-600" />
                              <span>+{drive.grantedPermissions.length}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Member Info */}
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {drive.memberName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {drive.specializationLabel}
                      </p>

                      {/* Gmail Display with 1-click Copy */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span className="text-xs font-mono font-bold text-slate-800 truncate">
                            {drive.memberEmail}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCopyMemberEmail(drive.memberEmail)}
                          className="text-[11px] font-semibold text-slate-500 hover:text-red-600 shrink-0"
                          title="Copy Gmail Address"
                        >
                          {copiedEmail === drive.memberEmail ? (
                            <span className="text-emerald-600 font-bold">Copied!</span>
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Subfolders Count */}
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                        <FolderCheck className="w-4 h-4 text-red-600 shrink-0" />
                        <span>
                          {drive.subfolders.length} Subfolders Provisioned
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPermissionModal(drive)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
                      >
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span>Manage Access ({drive.grantedPermissions?.length || 0} Delegated)</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={drive.driveWebUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
                        >
                          <span>Open in Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleOpenInspectModal(drive)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Subfolders</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setTransferTargetFolderId(drive.driveFolderId);
                          setTransferTargetFolderPath(drive.drivePath);
                          setTransferNewCategory(drive.role === 'PHOTOGRAPHER' ? 'RAW_PHOTO' : 'RAW_VIDEO');
                          setActiveTab('DATA_TRANSFER');
                          setProvisionMessage(`Target set to ${drive.memberName}'s drive. Select media to transfer.`);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-slate-50 transition-colors"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-red-600" />
                        <span>Transfer Data Into This Drive</span>
                      </button>

                      <div className="pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleDeleteMemberDrive(drive)}
                          disabled={isDeletingDriveId === drive.id}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                          title="Remove this account drive from Drive Studio"
                        >
                          {isDeletingDriveId === drive.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Remove Account Drive</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================= */}
      {/* TAB 2: MASTER SAVISKAR 2026 HIERARCHY */}
      {/* ================================================= */}
      {activeTab === 'MASTER_HIERARCHY' && (
        <div className="space-y-6 animate-fade-in">
          {/* Helpful Explainer: Google Drive Home vs My Drive Folders */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs shadow-2xs flex flex-col sm:flex-row sm:items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-bold text-amber-950 text-sm">
                Understanding Google Drive Views: Home vs. Folders
              </h4>
              <p className="text-amber-900/90 leading-relaxed text-xs">
                When you open Google Drive at <code className="bg-amber-100/90 px-1 py-0.5 rounded font-mono text-[11px]">drive.google.com/drive/home</code>, Google shows a chronological feed of recent files.
                All SAVISKAR photos and footage are strictly stored inside organized folders under <strong className="text-amber-950">My Drive &gt; DSA MEDIAVERSE SAVISKAR 26</strong>.
              </p>
            </div>
          </div>

          {/* Integration Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* OAuth Account Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorized Account</span>
              {isConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-emerald-700">Google Drive Connected</span>
                  </div>
                  <div className="text-xs text-slate-800 font-semibold bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/90 truncate">
                    {driveStatus?.userEmail || 'Active Google Token'}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <a
                      href={authData?.authUrl || driveStatus?.authUrl}
                      className="text-xs text-slate-600 hover:text-red-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Re-authorize</span>
                    </a>
                    <button
                      onClick={handleDisconnect}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-amber-700">Not Connected</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Authorize Google Drive so uploads stream into your folder structure.
                  </p>
                  {authData?.authUrl && (
                    <a
                      href={authData.authUrl}
                      className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-bold pt-1 hover:underline"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Authorize Google Account Access &rarr;</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Root Cloud Folder Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Root Cloud Folder</span>
                <button
                  onClick={handleCopyRootLink}
                  className="text-[11px] text-slate-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>
              <div className="text-xs font-bold text-red-700 bg-red-50/70 p-2.5 rounded-xl border border-red-200/80 truncate">
                DSA MEDIAVERSE SAVISKAR 26
              </div>
              <p className="text-[10px] text-slate-500 font-mono truncate">
                Folder ID: {rootId}
              </p>
              <a
                href={rootUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-red-600 hover:underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Root in Google Drive &rarr;</span>
              </a>
            </div>

            {/* Pipeline Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cloud Sync</span>
              <button
                onClick={handleSyncAll}
                disabled={isSyncing || !isConnected}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Master Folders in Drive'}</span>
              </button>
              <p className="text-xs text-slate-500">
                Creates any missing directories directly on Google Drive cloud storage.
              </p>
            </div>
          </div>

          {/* Main Tree View */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    SAVISKAR 2026 Interactive Master Folder Structure
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add, rename, or delete folders. Folders map directly to Google Drive.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleOpenAddModal(structure?.path)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Folder</span>
                </button>

                <button
                  onClick={handleResetStructure}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Reset to Default</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {structure ? (
                renderTree(structure)
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                  <span>Loading folder hierarchy...</span>
                </div>
              )}
            </div>
          </div>

          {/* URL Validator */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-red-600" />
                <span>Google Drive URL Validator</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Test any Google Drive sharing link or folder URL to verify access.
              </p>
            </div>

            <form onSubmit={handleValidateUrl} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                value={testUrl}
                onChange={e => setTestUrl(e.target.value)}
                placeholder="Paste Google Drive URL"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shrink-0 shadow-xs"
              >
                Validate Link
              </button>
            </form>

            {urlValidationResult && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Valid Google Drive Link:</span>
                  <span className={`font-bold ${urlValidationResult.isValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {urlValidationResult.isValid ? 'YES ✓ (Recognized Google Storage Link)' : 'NO ✗ (Unrecognized URL format)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* TAB 3: DATA & MEDIA TRANSFER STUDIO */}
      {/* ================================================= */}
      {activeTab === 'DATA_TRANSFER' && (
        <div className="space-y-6 animate-fade-in">
          {transferSuccessBanner && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between gap-3 shadow-2xs animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">{transferSuccessBanner}</span>
              </div>
              <button
                onClick={() => setTransferSuccessBanner(null)}
                className="text-[11px] font-bold text-emerald-900 hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Quick Transfer Presets */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
                  Quick Actions
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                1-Click Fast Destination Presets
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quickly select standard production destinations for transferring camera media.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => handleQuickTransferToVlogging(1)}
                className="p-4 rounded-xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Film className="w-5 h-5 text-purple-700" />
                  <span className="text-[10px] font-bold uppercase text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-200">
                    Day 1
                  </span>
                </div>
                <h4 className="text-xs font-bold text-purple-950 group-hover:text-purple-800">
                  Day 1 Vlogging & Video
                </h4>
                <p className="text-[11px] text-purple-700 mt-1">
                  Raw Videography & Vlog B-Roll
                </p>
              </button>

              <button
                onClick={() => handleQuickTransferToVlogging(2)}
                className="p-4 rounded-xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Film className="w-5 h-5 text-purple-700" />
                  <span className="text-[10px] font-bold uppercase text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-200">
                    Day 2
                  </span>
                </div>
                <h4 className="text-xs font-bold text-purple-950 group-hover:text-purple-800">
                  Day 2 Vlogging & Video
                </h4>
                <p className="text-[11px] text-purple-700 mt-1">
                  Fest Rush & Star Concert Clips
                </p>
              </button>

              <button
                onClick={() => {
                  setTransferTargetFolderId('1Mgc1jPrW1OnjXCWh24ExtC7Selj5v0kb');
                  setTransferTargetFolderPath('/DSA MEDIAVERSE SAVISKAR 26/Day 1/Editing Projects');
                  setTransferNewCategory('EDITED_DRAFT');
                  setProvisionMessage('Target set to Editing Projects. Select items below.');
                }}
                className="p-4 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Scissors className="w-5 h-5 text-blue-700" />
                  <span className="text-[10px] font-bold uppercase text-blue-600 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    Editors
                  </span>
                </div>
                <h4 className="text-xs font-bold text-blue-950 group-hover:text-blue-800">
                  Editing & Reels (9:16)
                </h4>
                <p className="text-[11px] text-blue-700 mt-1">
                  Deliver to Editing Suite
                </p>
              </button>

              <button
                onClick={() => {
                  setTransferTargetFolderId('1tFGNR9WZo_9dGgf_6zBOHdBnpPRxBQXQ');
                  setTransferTargetFolderPath('/DSA MEDIAVERSE SAVISKAR 26/Day 1/Photography');
                  setTransferNewCategory('RAW_PHOTO');
                  setProvisionMessage('Target set to Photography. Select items below.');
                }}
                className="p-4 rounded-xl bg-red-50/70 hover:bg-red-100/70 border border-red-200 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <Camera className="w-5 h-5 text-red-700" />
                  <span className="text-[10px] font-bold uppercase text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-200">
                    Photos
                  </span>
                </div>
                <h4 className="text-xs font-bold text-red-950 group-hover:text-red-800">
                  Photography Selects
                </h4>
                <p className="text-[11px] text-red-700 mt-1">
                  High-Res Color Graded RAW
                </p>
              </button>
            </div>
          </div>

          {/* Transfer Execution Console */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-red-600" />
                <span>Execute Media Transfer</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select destination folder, asset category, and media items. When executed, Google Drive updates the parent folder directly.
              </p>
            </div>

            {/* Target Destination Setup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Destination Folder
                </label>
                <select
                  value={transferTargetFolderId}
                  onChange={e => {
                    setTransferTargetFolderId(e.target.value);
                    const foundItem = flatList.find(f => f.driveFolderId === e.target.value);
                    if (foundItem) {
                      setTransferTargetFolderPath(foundItem.path);
                    } else {
                      const memberD = memberDrives.find(m => m.driveFolderId === e.target.value);
                      if (memberD) setTransferTargetFolderPath(memberD.drivePath);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Choose Target Folder --</option>
                  <optgroup label="Official Master Hierarchy">
                    {flatList.map(item => (
                      <option key={item.path} value={item.driveFolderId || item.path}>
                        📁 {item.name} ({item.path})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Member Gmail Drives">
                    {memberDrives.map(drive => (
                      <option key={drive.id} value={drive.driveFolderId}>
                        👤 {drive.memberName} ({drive.memberEmail})
                      </option>
                    ))}
                  </optgroup>
                </select>
                {transferTargetFolderPath && (
                  <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                    Destination: {transferTargetFolderPath}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Convert Asset Category to:
                </label>
                <select
                  value={transferNewCategory}
                  onChange={e => setTransferNewCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-red-500"
                >
                  <option value="RAW_VIDEO">RAW Video / Vlogging (4K Clips & BTS)</option>
                  <option value="RAW_PHOTO">RAW Photos (Stills & Keynotes)</option>
                  <option value="EDITED_DRAFT">Review Versions (Editing Drafts)</option>
                  <option value="FINAL_VIDEO">Approved Broadcast Deliverables</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Automatically updates metadata and tagging in the Central Media Library.
                </p>
              </div>
            </div>

            {/* Asset Selection List */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Select Media Assets</span>
                  <span className="text-xs text-slate-500">
                    ({selectedAssetIds.length} of {filteredTransferAssets.length} selected)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedAssetIds.length === filteredTransferAssets.length) {
                        setSelectedAssetIds([]);
                      } else {
                        setSelectedAssetIds(filteredTransferAssets.map(a => a.id));
                      }
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-bold hover:underline"
                  >
                    {selectedAssetIds.length === filteredTransferAssets.length ? 'Deselect All' : 'Select All'}
                  </button>

                  <select
                    value={transferFilterType}
                    onChange={e => setTransferFilterType(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700"
                  >
                    <option value="ALL">All Types</option>
                    <option value="RAW_PHOTO">Photos</option>
                    <option value="RAW_VIDEO">Videos</option>
                  </select>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {filteredTransferAssets.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No media assets available to transfer.
                  </div>
                ) : (
                  filteredTransferAssets.map(asset => {
                    const isSelected = selectedAssetIds.includes(asset.id);
                    return (
                      <div
                        key={asset.id}
                        onClick={() => {
                          setSelectedAssetIds(prev =>
                            isSelected ? prev.filter(id => id !== asset.id) : [...prev, asset.id]
                          );
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-red-50/80 border-red-300 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-900 truncate block">
                              {asset.filename}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {asset.media_type} • {asset.uploader_name || 'Crew'}
                            </span>
                          </div>
                        </div>

                        {asset.drive_file_id && (
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                            Drive ID: {asset.drive_file_id.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Execute Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleExecuteDataTransfer}
                disabled={isTransferring || selectedAssetIds.length === 0 || !transferTargetFolderId}
                className="px-6 py-3 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-2"
              >
                {isTransferring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Transferring in Google Drive...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Start Data Transfer ({selectedAssetIds.length} Assets)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* MODAL: CREATE MEMBER GMAIL DRIVE */}
      {/* ================================================= */}
      <Modal
        isOpen={showCreateMemberModal}
        onClose={() => setShowCreateMemberModal(false)}
        title="Create Google Drive for Member Gmail"
      >
        <form onSubmit={handleCreateMemberDrive} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Member Full Name
            </label>
            <input
              type="text"
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
              placeholder="e.g. Arjun Sharma, Sneha Kapoor"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Member Gmail Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                placeholder="e.g. arjun.photo@gmail.com"
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Google Drive automatically shares this folder with Editor permission to this Gmail address.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Department & Folder Structure
            </label>
            <div className="space-y-2">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                newMemberRole === 'PHOTOGRAPHER' ? 'bg-red-50/70 border-red-300' : 'bg-white border-slate-200'
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  checked={newMemberRole === 'PHOTOGRAPHER'}
                  onChange={() => setNewMemberRole('PHOTOGRAPHER')}
                  className="mt-0.5 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-bold text-slate-900">Photography ONLY (RAW & Stills)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Generates only photography folders (Keynotes RAW, Stills, Concert Stills, Selects). Zero video clutter!
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                newMemberRole === 'VIDEOGRAPHER' ? 'bg-purple-50/70 border-purple-300' : 'bg-white border-slate-200'
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  checked={newMemberRole === 'VIDEOGRAPHER'}
                  onChange={() => setNewMemberRole('VIDEOGRAPHER')}
                  className="mt-0.5 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-900">Videography & Vlogging (4K Clips & BTS)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Generates vlogging folders (BTS Campus Walk, Reactions, Multi-Cam, Drone B-Roll, Audio Stems).
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                newMemberRole === 'VIDEO_EDITOR' ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200'
              }`}>
                <input
                  type="radio"
                  name="memberRole"
                  checked={newMemberRole === 'VIDEO_EDITOR'}
                  onChange={() => setNewMemberRole('VIDEO_EDITOR')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Scissors className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Video Editing (Reels 9:16 & Recaps)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Generates editing folders (Reels 9:16, Recaps 16:9, Project files, Review exports).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Initial Access Level */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Google Drive Permission Level:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewMemberAccessLevel('writer')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  newMemberAccessLevel === 'writer'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Full Editor (writer)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Can upload, edit & delete files</p>
              </button>

              <button
                type="button"
                onClick={() => setNewMemberAccessLevel('reader')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  newMemberAccessLevel === 'reader'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Only (reader)</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Can view & download files only</p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCreateMemberModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingMemberDrive || !newMemberName.trim() || !newMemberEmail.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-2"
            >
              {isCreatingMemberDrive ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating in Google Drive...</span>
                </>
              ) : (
                <span>Create & Share Drive</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================================================= */}
      {/* MODAL: INSPECT & EDIT SUBFOLDERS IN DEPTH */}
      {/* ================================================= */}
      <Modal
        isOpen={showInspectModal}
        onClose={() => setShowInspectModal(false)}
        title={inspectingDrive ? `Manage Drive: ${inspectingDrive.memberName}` : 'Drive Subfolders'}
      >
        {inspectingDrive && (
          <div className="space-y-4">
            {/* Drive Header Info */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Shared Gmail:</span>
                <span className="font-bold text-slate-900 ml-1.5">{inspectingDrive.memberEmail}</span>
              </div>
              <a
                href={inspectingDrive.driveWebUrl}
                target="_blank"
                rel="noreferrer"
                className="text-red-600 hover:underline font-bold inline-flex items-center gap-1"
              >
                <span>Open in Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Add Subfolder Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubfolderInput}
                onChange={e => setNewSubfolderInput(e.target.value)}
                placeholder="New subfolder name (e.g. Drone Highlights, Day 3 Extra)"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddSubfolderToMemberDrive();
                }}
                className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
              <button
                onClick={handleAddSubfolderToMemberDrive}
                disabled={isAddingSubfolder || !newSubfolderInput.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 shrink-0"
              >
                {isAddingSubfolder ? 'Adding...' : '+ Add Subfolder'}
              </button>
            </div>

            {/* Subfolders List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {inspectingDrive.subfolders.map(sub => {
                const isRenamingThis = renamingSubfolderId === sub.id;
                return (
                  <div
                    key={sub.id}
                    className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2"
                  >
                    {isRenamingThis ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={renameSubfolderValue}
                          onChange={e => setRenameSubfolderValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameSubfolderInMemberDrive(sub.id);
                            if (e.key === 'Escape') setRenamingSubfolderId(null);
                          }}
                          className="flex-1 px-2.5 py-1 rounded-lg border-2 border-red-500 text-xs font-bold text-slate-900"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameSubfolderInMemberDrive(sub.id)}
                          disabled={isRenamingSubfolder || !renameSubfolderValue.trim()}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-red-600 text-white"
                        >
                          {isRenamingSubfolder ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setRenamingSubfolderId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen className="w-4 h-4 text-red-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {sub.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setRenamingSubfolderId(sub.id);
                              setRenameSubfolderValue(sub.name);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Rename Subfolder"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteSubfolderInMemberDrive(sub.id, sub.name)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete Subfolder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {sub.driveWebUrl && (
                            <a
                              href={sub.driveWebUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title="Open in Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowInspectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================================================= */}
      {/* MODAL: MANAGE PERMISSIONS & ACCESS DELEGATION */}
      {/* ================================================= */}
      <Modal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title={managingPermissionDrive ? `Access Control: ${managingPermissionDrive.memberName}'s Drive` : 'Manage Access'}
      >
        {managingPermissionDrive && (
          <div className="space-y-5">
            {/* Owner Access Summary Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-500 font-medium">Drive Owner:</span>
                  <span className="font-bold text-slate-900 ml-1.5">{managingPermissionDrive.memberName}</span>
                  <span className="text-slate-500 font-mono text-[11px] block">{managingPermissionDrive.memberEmail}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px] block uppercase font-bold">Owner Access</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAccessLevel(managingPermissionDrive)}
                    disabled={togglingAccessDriveId === managingPermissionDrive.id}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                      managingPermissionDrive.accessLevel === 'reader'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}
                  >
                    {managingPermissionDrive.accessLevel === 'reader' ? (
                      <>
                        <Eye className="w-3 h-3 text-amber-700" />
                        <span>Download Only 👁️</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 text-emerald-700" />
                        <span>Full Editor ✍️</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Grant Permission Form */}
            <form onSubmit={handleGrantPermission} className="p-4 rounded-2xl bg-red-50/50 border border-red-200/80 space-y-3.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-red-950">
                  Grant Access to Another Member (Download Only or Editor)
                </h4>
              </div>

              {/* Quick Select from Crew Users */}
              {crewUsers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Quick Select Registered Crew Member:
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                    {crewUsers.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setTargetPermEmail(u.email);
                          setTargetPermName(u.full_name);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                          targetPermEmail === u.email
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-red-300'
                        }`}
                      >
                        {u.full_name} ({u.roles?.[0] || 'CREW'})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Gmail Address *
                  </label>
                  <input
                    type="email"
                    value={targetPermEmail}
                    onChange={e => setTargetPermEmail(e.target.value)}
                    placeholder="e.g. member@gmail.com"
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Member Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={targetPermName}
                    onChange={e => setTargetPermName(e.target.value)}
                    placeholder="e.g. Aman Sharma"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Role Choice: Download Only vs Full Editor */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Permission Level:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetPermRole('reader')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      targetPermRole === 'reader'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span>Download Only (Viewer)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Can view, stream & download photos and video. CANNOT edit, rename, upload or delete files.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetPermRole('writer')}
                    className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      targetPermRole === 'writer'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Full Editor</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                      Can upload new media, rename, edit folders, and delete files directly in Google Drive.
                    </p>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGrantingPerm || !targetPermEmail.trim()}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                {isGrantingPerm ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Granting in Google Drive...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5" />
                    <span>Grant {targetPermRole === 'reader' ? 'Download Only' : 'Editor'} Access</span>
                  </>
                )}
              </button>
            </form>

            {/* Currently Delegated Permissions List */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Delegated Permissions ({managingPermissionDrive.grantedPermissions?.length || 0})
              </h4>

              {(!managingPermissionDrive.grantedPermissions || managingPermissionDrive.grantedPermissions.length === 0) ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  No other members have been delegated access to this drive yet. Use the form above to grant Download Only or Editor access.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {managingPermissionDrive.grantedPermissions.map(perm => (
                    <div
                      key={perm.email}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {perm.name || perm.email}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            perm.role === 'reader'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {perm.role === 'reader' ? '👁️ Download Only' : '✍️ Full Editor'}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                          {perm.email} • Granted by {perm.grantedBy}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokePermission(perm.email)}
                        disabled={revokingPermEmail === perm.email}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                        title="Revoke Google Drive access"
                      >
                        {revokingPermEmail === perm.email ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>Revoke</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowPermissionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================================================= */}
      {/* MODAL: ADD MASTER FOLDER */}
      {/* ================================================= */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Folder to Master Hierarchy"
      >
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Parent Folder Destination
            </label>
            <select
              value={addParentPath}
              onChange={e => setAddParentPath(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-red-500"
            >
              {flatList.map(item => (
                <option key={item.path} value={item.path}>
                  {'\u00A0'.repeat(item.level * 3)}📁 {item.name} ({item.path})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Folder Name
            </label>
            <input
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="e.g. VIP Interviews, Drone Coverage, Sponsor Stalls"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding || !newFolderName.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors"
            >
              {isAdding ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================================================= */}
      {/* MODAL: RENAME MASTER FOLDER */}
      {/* ================================================= */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename Folder"
      >
        <form onSubmit={handleRenameFolder} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Current Folder
            </label>
            <p className="text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded-lg border border-slate-200 truncate">
              {renameTarget?.path}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              New Folder Name
            </label>
            <input
              type="text"
              value={newRenameValue}
              onChange={e => setNewRenameValue(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowRenameModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRenaming || !newRenameValue.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors"
            >
              {isRenaming ? 'Renaming...' : 'Save Name'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
