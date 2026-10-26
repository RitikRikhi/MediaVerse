import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
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
  ChevronDown
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';

export const DriveSettingsPage: React.FC = () => {
  const [driveStatus, setDriveStatus] = useState<any>(null);
  const [authData, setAuthData] = useState<any>(null);
  const [structure, setStructure] = useState<any>(null);
  const [flatList, setFlatList] = useState<any[]>([]);
  const [provisionMessage, setProvisionMessage] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [testUrl, setTestUrl] = useState('https://drive.google.com/drive/u/0/folders/1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4');
  const [urlValidationResult, setUrlValidationResult] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Folder management state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentPath, setAddParentPath] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Rename folder state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ path: string; name: string } | null>(null);
  const [newRenameValue, setNewRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

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
      const [status, structRes, authRes] = await Promise.all([
        api.getDriveStatus(),
        api.getDriveFolderStructure().catch(() => ({ structure: null, flatList: [] })),
        api.getDriveAuthUrl().catch(() => ({ authUrl: '', isConfigured: false }))
      ]);
      setDriveStatus(status);
      setStructure(structRes.structure);
      setFlatList(structRes.flatList || []);
      setAuthData(authRes);
      if (structRes.structure && !addParentPath) {
        setAddParentPath(structRes.structure.path);
      }
    } catch (err) {
      console.error('Failed to load drive settings', err);
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
    const rootUrl = driveStatus?.rootFolderUrl || 'https://drive.google.com/drive/u/0/folders/1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4';
    navigator.clipboard.writeText(rootUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Recursive tree renderer
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

                {/* Google Drive Status Badge */}
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

  const rootUrl = driveStatus?.rootFolderUrl || 'https://drive.google.com/drive/u/0/folders/1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4';
  const rootId = driveStatus?.rootFolderId || '1SdY0hIYAiYGL0DFzyeVjLOssg7sEdSP4';
  const isConnected = Boolean(driveStatus?.isConnected);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Google Drive Cloud Storage
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026 Production Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Google Drive & Folder Tree Studio
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Design, customize, and provision the complete event folder structure. Every folder created here maps directly to Google Drive so camera crew uploads land in organized folders.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => handleOpenAddModal(structure?.path)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-red-600" />
            <span>+ Add Folder</span>
          </button>

          <button
            onClick={handleSyncAll}
            disabled={isSyncing || !isConnected}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white shadow-xs transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Creating in Google Drive...' : 'Sync All Folders in Drive'}</span>
          </button>

          <a
            href={rootUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Drive Root</span>
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
            When you open Google Drive at <code className="bg-amber-100/90 px-1 py-0.5 rounded font-mono text-[11px]">drive.google.com/drive/home</code>, Google shows a chronological feed of recent files across your entire account.
            All SAVISKAR photos and footage are strictly stored inside organized folders under <strong className="text-amber-950">My Drive &gt; DSA MEDIAVERSE SAVISKAR 26</strong>.
          </p>
          <p className="text-amber-800 text-[11px] font-medium">
            💡 <strong>Quick tip:</strong> Click the <span className="font-bold underline text-amber-950">Open Folder ↗</span> button next to any folder in the tree below to open that specific folder in Google Drive.
          </p>
        </div>
      </div>

      {/* Integration Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* OAuth 2.0 Account Card */}
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

        {/* Configured Root Folder Card */}
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
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Automated Hierarchy</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900">Direct Folder Streaming</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Uploads from field photographers, videographers, and editors route into their exact category subfolder with zero local disk limits.
          </p>
        </div>
      </div>

      {/* Main Folder Hierarchy Tree Builder */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                SAVISKAR 2026 Interactive Folder Structure
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Add, rename, or remove folders. Click "Sync All Folders in Drive" to create them on Google Drive with 1 click.
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

        {/* Tree Render */}
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

      {/* URL Validator & Resource Parser */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-red-600" />
            <span>Google Drive URL Validator & Resource Inspector</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Test any Google Drive sharing link or folder URL to verify access before SAVISKAR live coverage.
          </p>
        </div>

        <form onSubmit={handleValidateUrl} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="url"
            value={testUrl}
            onChange={e => setTestUrl(e.target.value)}
            placeholder="Paste Google Drive URL (https://drive.google.com/file/d/... or /folders/...)"
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
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
            {urlValidationResult.fileId && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Resource ID:</span>
                <span className="font-mono text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {urlValidationResult.fileId}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Resource Type:</span>
              <span className="px-2 py-0.5 rounded bg-white text-slate-700 font-semibold border border-slate-200">
                {urlValidationResult.isFolder ? 'Folder (Directory Tree)' : 'File (Video / Photo Asset)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add New Folder */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Folder to Drive Hierarchy"
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
            {newFolderName.trim() && (
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Full path: {addParentPath}/{newFolderName.trim()}
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            If Google Drive is connected, this folder will be created immediately in your Drive account.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={isAdding}
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

      {/* Modal: Rename Folder */}
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
              disabled={isRenaming}
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
