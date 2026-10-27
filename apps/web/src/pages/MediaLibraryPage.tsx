import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { MediaAsset } from '../types';
import { Modal } from '../components/ui/Modal';
import {
  Search,
  Grid,
  List,
  FolderOpen,
  ExternalLink,
  Camera,
  Film,
  Music,
  CheckCircle,
  FileSpreadsheet,
  Download,
  Filter,
  ArrowRightLeft,
  RefreshCw,
  Scissors
} from 'lucide-react';

export const MediaLibraryPage: React.FC = () => {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Transfer State
  const [transferAsset, setTransferAsset] = useState<MediaAsset | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ');
  const [transferTargetPath, setTransferTargetPath] = useState('/DSA MEDIAVERSE SAVISKAR 26/Day 1/Raw Videography');
  const [transferCategory, setTransferCategory] = useState('RAW_VIDEO');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferToast, setTransferToast] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [dayFilter, setDayFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const loadMedia = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMediaAssets();
      setAssets(data);
    } catch (err) {
      console.error('Failed to load media assets', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  useEffect(() => {
    let list = [...assets];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        a =>
          a.filename.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          (a.tags && a.tags.some(t => t.toLowerCase().includes(q))) ||
          (a.uploader_name && a.uploader_name.toLowerCase().includes(q)) ||
          (a.assignment_title && a.assignment_title.toLowerCase().includes(q))
      );
    }
    if (typeFilter !== 'ALL') {
      list = list.filter(a => a.media_type === typeFilter);
    }
    if (dayFilter !== 'ALL') {
      list = list.filter(a =>
        a.assignment_title?.toLowerCase().includes(dayFilter.toLowerCase())
      );
    }
    setFilteredAssets(list);
  }, [assets, search, typeFilter, dayFilter]);

  const handleExecuteQuickTransfer = async () => {
    if (!transferAsset) return;
    try {
      setIsTransferring(true);
      await api.transferMediaData({
        assetIds: [transferAsset.id],
        targetFolderId: transferTargetId,
        targetFolderPath: transferTargetPath,
        newCategory: transferCategory
      });
      setTransferToast(`Transferred "${transferAsset.filename}" into ${transferTargetPath}!`);
      setTransferAsset(null);
      await loadMedia();
    } catch (err: any) {
      alert(`Transfer failed: ${err.message || err}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const typeIcons: Record<string, any> = {
    RAW_PHOTO: Camera,
    RAW_VIDEO: Film,
    EDITED_DRAFT: Film,
    FINAL_VIDEO: Film,
    AUDIO_STEM: Music,
    GRAPHIC_ASSET: FileSpreadsheet,
    OTHER: FolderOpen
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Verified in Drive';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
              Asset Archive
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Central Media Library
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified repository of Google Drive photos, 4K camera clips, audio tracks, and broadcast delivery masters.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              viewMode === 'grid'
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              viewMode === 'table'
                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Table View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by filename, tags, uploader, or event..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Day Filter */}
          <select
            value={dayFilter}
            onChange={e => setDayFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Days</option>
            <option value="Day 1">Day 1 Coverage</option>
            <option value="Day 2">Day 2 Coverage</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
          >
            <option value="ALL">All Asset Types</option>
            <option value="RAW_PHOTO">RAW Photos</option>
            <option value="RAW_VIDEO">RAW 4K Video</option>
            <option value="EDITED_DRAFT">Review Cuts</option>
            <option value="FINAL_VIDEO">Broadcast Masters</option>
            <option value="AUDIO_STEM">Audio Stems</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 font-medium">Loading media repository...</div>
      ) : filteredAssets.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs p-8">
          No registered media assets found matching your criteria.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map(asset => {
            const Icon = typeIcons[asset.media_type] || FolderOpen;
            return (
              <div
                key={asset.id}
                className="rounded-2xl bg-white border border-slate-200/80 shadow-card hover:border-slate-300 hover:shadow-card-hover overflow-hidden transition-all flex flex-col justify-between"
              >
                {/* Thumbnail Header */}
                <div className="relative aspect-video bg-slate-100 overflow-hidden group">
                  <img
                    src={asset.drive_thumbnail_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400'}
                    alt={asset.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/75 backdrop-blur-xs text-white">
                    {asset.media_type.replace('_', ' ')}
                  </div>
                  {asset.is_verified && (
                    <div
                      className="absolute top-2.5 right-2.5 p-1 rounded-full bg-emerald-600 text-white shadow-xs"
                      title="Google Drive Link Verified"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate" title={asset.filename}>
                      {asset.filename}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1">
                      {asset.description || 'SAVISKAR 2026 Production File'}
                    </p>
                    <p className="text-[11px] text-red-600 font-bold truncate">
                      {asset.assignment_title || 'SAVISKAR 2026'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.map(t => (
                          <span
                            key={t}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>By {asset.uploader_name || 'Field Crew'}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setTransferAsset(asset);
                            setTransferTargetId('1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ');
                            setTransferTargetPath('/DSA MEDIAVERSE SAVISKAR 26/Day 1/Raw Videography');
                            setTransferCategory('RAW_VIDEO');
                          }}
                          className="inline-flex items-center gap-1 font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded transition-colors"
                          title="Transfer this asset to Vlogging / Folder"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>Transfer</span>
                        </button>

                        <a
                          href={asset.drive_web_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700"
                        >
                          <span>Open Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-card overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Filename</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Linked Assignment</th>
                <th className="px-4 py-3">Uploader</th>
                <th className="px-4 py-3">File Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredAssets.map(asset => (
                <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3 font-bold text-slate-900">{asset.filename}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {asset.media_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{asset.assignment_title || 'General Fest'}</td>
                  <td className="px-4 py-3">{asset.uploader_name}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                    {formatFileSize(asset.file_size_bytes)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setTransferAsset(asset);
                          setTransferTargetId('1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ');
                          setTransferTargetPath('/DSA MEDIAVERSE SAVISKAR 26/Day 1/Raw Videography');
                          setTransferCategory('RAW_VIDEO');
                        }}
                        className="inline-flex items-center gap-1 font-bold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded transition-colors text-[11px]"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Transfer</span>
                      </button>

                      <a
                        href={asset.drive_web_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-bold"
                      >
                        <span>Drive File</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Transfer Modal */}
      <Modal
        isOpen={Boolean(transferAsset)}
        onClose={() => setTransferAsset(null)}
        title="Transfer Media Asset Directly on Google Drive"
      >
        {transferAsset && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Asset to Transfer</span>
              <p className="text-xs font-bold text-slate-900 truncate">{transferAsset.filename}</p>
              <p className="text-[11px] text-slate-500">Current Category: {transferAsset.media_type}</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Destination
              </label>
              <div className="space-y-2">
                <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                  transferTargetId === '1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ' ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="quickTarget"
                      checked={transferTargetId === '1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ'}
                      onChange={() => {
                        setTransferTargetId('1m7U0n1wuICACLVBmKl8YYLqEXvmVALWQ');
                        setTransferTargetPath('/DSA MEDIAVERSE SAVISKAR 26/Day 1/Raw Videography');
                        setTransferCategory('RAW_VIDEO');
                      }}
                      className="text-purple-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900">Day 1 Vlogging & Raw Videography</span>
                      <p className="text-[10px] text-slate-500">Moves file directly to Day 1 Video folder</p>
                    </div>
                  </div>
                  <Film className="w-4 h-4 text-purple-600" />
                </label>

                <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                  transferTargetId === '1LF1A9AbGiWyQlYKT0V0v7LH3OPCcBGUF' ? 'bg-purple-50 border-purple-300' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="quickTarget"
                      checked={transferTargetId === '1LF1A9AbGiWyQlYKT0V0v7LH3OPCcBGUF'}
                      onChange={() => {
                        setTransferTargetId('1LF1A9AbGiWyQlYKT0V0v7LH3OPCcBGUF');
                        setTransferTargetPath('/DSA MEDIAVERSE SAVISKAR 26/Day 2/Raw Videography');
                        setTransferCategory('RAW_VIDEO');
                      }}
                      className="text-purple-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900">Day 2 Vlogging & Raw Videography</span>
                      <p className="text-[10px] text-slate-500">Moves file directly to Day 2 Video folder</p>
                    </div>
                  </div>
                  <Film className="w-4 h-4 text-purple-600" />
                </label>

                <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                  transferTargetId === '1Mgc1jPrW1OnjXCWh24ExtC7Selj5v0kb' ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="quickTarget"
                      checked={transferTargetId === '1Mgc1jPrW1OnjXCWh24ExtC7Selj5v0kb'}
                      onChange={() => {
                        setTransferTargetId('1Mgc1jPrW1OnjXCWh24ExtC7Selj5v0kb');
                        setTransferTargetPath('/DSA MEDIAVERSE SAVISKAR 26/Day 1/Editing Projects');
                        setTransferCategory('EDITED_DRAFT');
                      }}
                      className="text-blue-600"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900">Editing Suite (Reels & Recaps)</span>
                      <p className="text-[10px] text-slate-500">Hands over footage to video editors</p>
                    </div>
                  </div>
                  <Scissors className="w-4 h-4 text-blue-600" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTransferAsset(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteQuickTransfer}
                disabled={isTransferring}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-2"
              >
                {isTransferring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Transferring in Google Drive...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Confirm Transfer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
