import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { History, Download, Search, ShieldCheck } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const data = await api.getAuditLogs(100);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredLogs(logs);
      return;
    }
    const q = search.toLowerCase();
    setFilteredLogs(
      logs.filter(
        l =>
          (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
          l.action.toLowerCase().includes(q) ||
          l.entity_type.toLowerCase().includes(q)
      )
    );
  }, [logs, search]);

  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/v1/reports/export?format=${format}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-red-600" />
              GOVERNANCE & AUDIT TRAIL
            </span>
            <span className="text-xs text-slate-500">• SAVISKAR 2026</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Operational Activity & Audit Trail
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Immutable log of status transitions, media uploads, version submissions, and reviewer sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-red-600" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Backup JSON</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center gap-2.5">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter audit logs by crew member, action (e.g. TRANSITION_STATUS, UPLOAD_MEDIA), or entity..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
        />
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-500">Loading audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500">No activity logs matching your filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Crew Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity Type</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 font-sans">
                      {log.actor_name || 'System'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                        {log.actor_role || 'SYSTEM'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-red-700 font-bold font-mono text-[11px] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-sans">{log.entity_type}</td>
                    <td className="px-4 py-3 text-slate-500 text-[11px] max-w-xs truncate" title={JSON.stringify(log.details)}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
