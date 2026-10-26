import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Assignment } from '../types';
import {
  Sparkles,
  Send,
  Camera,
  Film,
  Share2,
  BarChart2,
  Copy,
  Check,
  Cpu,
  ShieldCheck,
  AlertCircle,
  Wrench,
  AlertTriangle,
  Tag,
  Zap,
  Download,
  ListPlus,
  RefreshCw,
  Clock,
  Database
} from 'lucide-react';

export const AIAssistantPage: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [contextType, setContextType] = useState<
    | 'GENERAL'
    | 'SHOTLIST'
    | 'EDITING_BRIEF'
    | 'SOCIAL_CAPTION'
    | 'STATUS_SUMMARY'
    | 'EQUIPMENT_CHECK'
    | 'CRISIS_RESOLVE'
    | 'ASSET_TAGGER'
  >('SHOTLIST');
  const [response, setResponse] = useState<string>('');
  const [responseMeta, setResponseMeta] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [isApplyingChecklist, setIsApplyingChecklist] = useState(false);
  const [applyChecklistMsg, setApplyChecklistMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadTelemetry = async () => {
    try {
      const [tData, aList] = await Promise.all([
        api.getAITelemetry(),
        api.getAssignments()
      ]);
      setTelemetry(tData);
      setAssignments(aList);
      if (aList.length > 0 && !selectedAssignmentId) {
        setSelectedAssignmentId(aList[0].id);
      }
    } catch (err) {
      console.warn('Telemetry load error', err);
    }
  };

  useEffect(() => {
    loadTelemetry();
    const interval = setInterval(loadTelemetry, 15000);
    return () => clearInterval(interval);
  }, []);

  const handlePrompt = async (
    customPrompt?: string,
    customContext?:
      | 'GENERAL'
      | 'SHOTLIST'
      | 'EDITING_BRIEF'
      | 'SOCIAL_CAPTION'
      | 'STATUS_SUMMARY'
      | 'EQUIPMENT_CHECK'
      | 'CRISIS_RESOLVE'
      | 'ASSET_TAGGER'
  ) => {
    const textToSend = customPrompt || prompt;
    const typeToSend = customContext || contextType;

    if (!textToSend.trim()) return;

    try {
      setIsLoading(true);
      setResponse('');
      setResponseMeta(null);
      setApplyChecklistMsg('');

      const res = await api.promptAI({
        prompt: textToSend,
        context_type: typeToSend,
        assignment_id: selectedAssignmentId || undefined
      });

      setResponse(res.text);
      setResponseMeta(res);
      api.getAITelemetry().then(setTelemetry).catch(() => {});
    } catch (err: any) {
      setResponse(`Error: ${err.message || 'AI request failed'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    if (!response) return;
    const blob = new Blob([response], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SAVISKAR_2026_${contextType}_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePushToChecklist = async () => {
    if (!selectedAssignmentId || !response) return;
    try {
      setIsApplyingChecklist(true);
      setApplyChecklistMsg('');
      const res = await api.applyShotlistToAssignment(selectedAssignmentId, response);
      setApplyChecklistMsg(`Successfully added ${res.addedCount} AI checklist shots to assignment!`);
    } catch (err: any) {
      setApplyChecklistMsg(`Failed to push checklist: ${err.message}`);
    } finally {
      setIsApplyingChecklist(false);
    }
  };

  const quickPrompts = [
    {
      title: 'Grand Inauguration & Lamp Lighting',
      desc: 'Chancellor & VIP ceremonial arrivals and framing',
      icon: Camera,
      context: 'SHOTLIST' as const,
      prompt: 'Generate an exhaustive photography and videography shot list for the SAVISKAR 2026 Grand Inauguration & Lamp Lighting ceremony featuring VIPs.'
    },
    {
      title: 'Day 1 Rock Band & Concert Reel',
      desc: '45-second 9:16 high-energy beat-matched brief',
      icon: Film,
      context: 'EDITING_BRIEF' as const,
      prompt: 'Draft an editing brief for 45-second 9:16 Instagram Reel highlighting the energy, crowd reactions, and solo guitar riffs from Battle of the Bands.'
    },
    {
      title: 'Viral Instagram & Shorts Captions',
      desc: 'High-engagement copy with hashtags & emojis',
      icon: Share2,
      context: 'SOCIAL_CAPTION' as const,
      prompt: 'Draft 3 viral caption options for Instagram Reels and YouTube Shorts celebrating Day 1 highlights with trending SAVISKAR hashtags.'
    },
    {
      title: 'Live Production Status Briefing',
      desc: 'Executive breakdown of bottlenecks & deliverables',
      icon: BarChart2,
      context: 'STATUS_SUMMARY' as const,
      prompt: 'Summarize today\'s media crew operational progress, bottlenecks, and tasks awaiting review.'
    },
    {
      title: 'Camera Crew Gear Readiness Audit',
      desc: 'Lens checks, audio safety channels & batteries',
      icon: Wrench,
      context: 'EQUIPMENT_CHECK' as const,
      prompt: 'Formulate an equipment readiness checklist for a 3-person camera team covering the evening stage concert.'
    },
    {
      title: 'Run-of-Show Contingency & Crisis Triage',
      desc: 'Delays, audio buzz, low-light & weather safety',
      icon: AlertTriangle,
      context: 'CRISIS_RESOLVE' as const,
      prompt: 'Provide a fast emergency contingency guide for handling severe low-light shifts and stage audio interference during live performances.'
    }
  ];

  const getModeBadge = (mode?: string) => {
    switch (mode) {
      case 'GEMINI_API':
        return {
          label: 'Live Gemini Cloud AI',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'CACHE_SAVER':
        return {
          label: 'Semantic Cache Hit (0 Tokens Used)',
          color: 'bg-red-50 text-red-700 border-red-200'
        };
      case 'QUOTA_GUARD_SYNTHESIZER':
        return {
          label: 'Free-Tier Quota Guard Active',
          color: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      default:
        return {
          label: 'Smart Rule Synthesizer (Offline Fallback)',
          color: 'bg-slate-100 text-slate-700 border-slate-200'
        };
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              AI Creative Assistant
            </span>
            <span className="text-xs text-slate-500 font-medium">• SAVISKAR 2026</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            AI Operations & Creative Assistant
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Generates curated camera shot lists, editing briefs, viral captions, and festival crisis checklists with zero-budget quota protection.
          </p>
        </div>

        {/* Telemetry badge */}
        <div className="flex items-center gap-3 self-start md:self-auto px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-red-600" />
            <span className="text-slate-500">Model:</span>
            <span className="font-bold text-slate-900">{telemetry?.activeModel || 'gemini-3.5-flash-lite'}</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-bold text-emerald-700">Protected</span>
          </div>
        </div>
      </div>

      {/* Free-Tier Token Optimization Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Engine Status</span>
            <p className="text-xs font-bold text-emerald-700">Zero-Error Guard</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-100">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Cache Hit Rate</span>
            <p className="text-xs font-bold text-slate-900">{telemetry?.cacheHitRate || '0.0%'}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Tokens Saved</span>
            <p className="text-xs font-bold text-blue-700">{(telemetry?.totalTokensSaved || 0).toLocaleString()} tokens</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">RPM Headroom</span>
            <p className="text-xs font-bold text-slate-900">{telemetry?.rateLimitHeadroom ?? 12} calls/min</p>
          </div>
        </div>
      </div>

      {/* Quick 1-Click Operational Presets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            SAVISKAR 2026 Production Presets (1-Click Run)
          </h2>
          <span className="text-[11px] text-slate-400">Curated for rapid festival operations</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickPrompts.map((card, i) => {
            const Icon = card.icon;
            return (
              <button
                key={i}
                onClick={() => {
                  setPrompt(card.prompt);
                  setContextType(card.context);
                  handlePrompt(card.prompt, card.context);
                }}
                className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-red-300 hover:shadow-card-hover text-left transition-all flex items-start gap-3.5 group"
              >
                <div className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-red-700">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{card.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Prompt Composer */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-red-600" />
            <label className="text-xs font-bold text-slate-900">Custom Operational Prompt</label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Assistant Mode:</span>
            <select
              value={contextType}
              onChange={e => setContextType(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-red-500"
            >
              <option value="SHOTLIST">📸 Photography & Video Shot List</option>
              <option value="EDITING_BRIEF">🎬 Video Editing Brief (9:16 & 16:9)</option>
              <option value="SOCIAL_CAPTION">📱 Viral Social Caption & Tags</option>
              <option value="STATUS_SUMMARY">📊 Live Production Briefing</option>
              <option value="EQUIPMENT_CHECK">🎒 Equipment & Gear Readiness</option>
              <option value="CRISIS_RESOLVE">⚡ Contingency & Festival Triage</option>
              <option value="ASSET_TAGGER">🏷️ Google Drive Asset Naming & Tags</option>
              <option value="GENERAL">💬 General Operations Assistant</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2.5">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Type your prompt (e.g., 'Suggest shot angles and lighting for the evening Star Night rock performance' or 'Write an editing brief for Day 2 aftermovie with EDM beat-sync')..."
            rows={2}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-red-500 font-medium"
          />
          <button
            onClick={() => handlePrompt()}
            disabled={isLoading || !prompt.trim()}
            className="px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generated Response Container */}
      {response && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-slate-900">
                Generated Guidance Output
              </span>
              {responseMeta && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getModeBadge(responseMeta.mode).color}`}>
                  {getModeBadge(responseMeta.mode).label}
                </span>
              )}
              {responseMeta?.durationMs && (
                <span className="text-[10px] text-slate-400 font-mono">
                  {responseMeta.durationMs}ms
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handleExportMarkdown}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                title="Download as Markdown"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export .md</span>
              </button>
            </div>
          </div>

          {/* Push to Assignment Checklist */}
          {contextType === 'SHOTLIST' && assignments.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50/60 border border-red-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ListPlus className="w-5 h-5 text-red-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-red-900">Push to Field Crew Checklist: </span>
                  <span className="text-red-700">Convert these shots into interactive checklist tasks for field camera crew.</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <select
                  value={selectedAssignmentId}
                  onChange={e => setSelectedAssignmentId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 max-w-[200px] truncate"
                >
                  {assignments.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.day_session})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handlePushToChecklist}
                  disabled={isApplyingChecklist}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors shrink-0 flex items-center gap-1.5 shadow-2xs"
                >
                  {isApplyingChecklist ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ListPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Push Shots</span>
                </button>
              </div>
            </div>
          )}

          {applyChecklistMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{applyChecklistMsg}</span>
            </div>
          )}

          <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/70 p-5 rounded-xl border border-slate-200/80">
            {response}
          </div>
        </div>
      )}
    </div>
  );
};
