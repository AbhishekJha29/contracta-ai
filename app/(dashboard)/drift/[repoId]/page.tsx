'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { mockDiffEntries, mockRepo } from '@/lib/mock-data';
import { DiffCard } from '@/components/diff-card';
import { Topbar } from '@/components/topbar';
import { formatDiff } from '@/lib/diff/formatDiff';
import { DiffEntry } from '@/lib/diff/types';
import {
  AlertOctagon,
  CheckCircle2,
  GitPullRequest,
  ShieldAlert,
  Download,
  PlusCircle,
  Flame,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FolderGit2,
  FileCheck2,
  Copy,
  Check,
} from 'lucide-react';

export default function DriftPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.repoId || 'demo';
  const isDemo = repoId === 'demo';

  // State
  const [loading, setLoading] = useState(!isDemo);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoData, setRepoData] = useState<any>(null);
  const [diffEntries, setDiffEntries] = useState<DiffEntry[]>(isDemo ? (mockDiffEntries as any) : []);
  const [selectedReportIndex, setSelectedReportIndex] = useState(0);
  const [filter, setFilter] = useState<'all' | 'breaking' | 'non-breaking'>('all');
  const [copiedReport, setCopiedReport] = useState(false);

  // Load Repository & Drift Reports
  const loadDriftData = async () => {
    if (isDemo) {
      setDiffEntries(mockDiffEntries as any);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/repos/${repoId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Repository "${repoId}" was not found or is not connected to your account.`);
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Access denied: You do not have permission to view drift reports for "${repoId}".`);
        }
        throw new Error(`Failed to load repository details (${res.status})`);
      }
      const data = await res.json();
      setRepoData(data.repo);

      const reports = data.repo?.driftReports || [];
      if (reports.length > 0) {
        const activeReport = reports[selectedReportIndex] || reports[0];
        const entries = (activeReport.diffJson as DiffEntry[]) || [];
        setDiffEntries(entries);
      } else {
        setDiffEntries([]);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred loading drift reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDriftData();
  }, [repoId, selectedReportIndex]);

  // Trigger Re-check for Drift via Background Queue
  const triggerRecheck = async () => {
    if (isDemo) return;

    try {
      setRechecking(true);
      setError(null);

      const initialReportCount = repoData?.driftReports?.length ?? 0;
      const initialVersion = repoData?.baselines?.[0]?.version ?? 0;

      const res = await fetch(`/api/repos/${repoId}/analyze`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enqueue drift check job');
      }

      console.log('[Drift UI] Enqueued analysis & drift check job:', data.jobId);

      // Poll /api/repos/${repoId}/status every 2 seconds
      const maxAttempts = 40;
      let attempts = 0;
      let completed = false;

      while (attempts < maxAttempts && !completed) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;

        try {
          const statusRes = await fetch(`/api/repos/${repoId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const latestBaseline = statusData.latestBaseline;
            const hasNewReport = statusData.hasDriftReport && (statusData.latestDriftReport || latestBaseline?.version > initialVersion);

            if (latestBaseline && latestBaseline.version > initialVersion) {
              completed = true;
              await loadDriftData();
              break;
            }
          }
        } catch {
          // ignore transient polling errors
        }
      }

      if (!completed) {
        throw new Error('Drift check is taking longer than expected. Please ensure the background worker ("npm run worker") is running.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete drift check.');
    } finally {
      setRechecking(false);
    }
  };

  const reports = repoData?.driftReports || [];
  const latestReport = reports[selectedReportIndex] || reports[0];
  const baselineVersion = latestReport?.baselineVersion ?? repoData?.baselines?.[0]?.version ?? 1;

  const breakingCount = diffEntries.filter((d) => d.severity === 'breaking').length;
  const nonBreakingCount = diffEntries.filter((d) => d.severity === 'non-breaking').length;

  const filteredEntries = diffEntries.filter((entry) => {
    if (filter === 'breaking') return entry.severity === 'breaking';
    if (filter === 'non-breaking') return entry.severity === 'non-breaking';
    return true;
  });

  const handleExportMarkdown = () => {
    const md = formatDiff(diffEntries);
    navigator.clipboard.writeText(md);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar currentSection="drift" repoId={repoId} />

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Rechecking / Analyzing Banner */}
        {rechecking && (
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/30 text-cyan-200 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
              <div>
                <p className="text-sm font-semibold">Running Background AST Drift Check...</p>
                <p className="text-xs text-cyan-300/80">
                  Worker is pulling latest source archive, extracting routes, and comparing against Baseline v{baselineVersion}.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono px-2 py-1 bg-cyan-900/50 rounded text-cyan-300">Phase 10 Engine</span>
          </div>
        )}

        {/* Full error state if repo cannot be loaded */}
        {!loading && error && !repoData && !isDemo && (
          <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-950 space-y-4 max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-white">Repository Not Accessible</h2>
              <p className="text-xs text-rose-300/90 leading-relaxed font-mono">{error}</p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg transition-all"
              >
                Return to Dashboard
              </Link>
              <Link
                href="/drift/demo"
                className="px-4 py-2 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
              >
                View Demo Drift
              </Link>
            </div>
          </div>
        )}

        {/* Error Alert for transient errors */}
        {error && repoData && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold">Drift Check Notice</p>
              <p className="text-xs text-rose-300/90 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => triggerRecheck()}
                className="mt-2 text-xs font-mono font-medium text-rose-300 hover:text-white underline cursor-pointer"
              >
                Retry drift check &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {repoData ? `${repoData.owner}/${repoData.name} — Drift & Breaking Changes` : 'Contract Drift & Breaking Changes'}
              </h1>
              {latestReport ? (
                latestReport.severity === 'breaking' ? (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold flex items-center gap-1">
                    <Flame className="w-3 h-3 text-rose-400" />
                    {breakingCount} Breaking Detected
                  </span>
                ) : (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Contract Clean
                  </span>
                )
              ) : (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Initial Baseline
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {latestReport
                ? `Comparing latest AST analysis against Baseline (v${latestReport.baselineVersion}) saved on ${new Date(latestReport.createdAt).toLocaleDateString()}.`
                : 'Showing baseline comparison state for this repository.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {!isDemo && (
              <button
                type="button"
                onClick={() => triggerRecheck()}
                disabled={rechecking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${rechecking ? 'animate-spin' : ''}`} />
                <span>{rechecking ? 'Checking...' : 'Re-check for drift'}</span>
              </button>
            )}

            {repoData && (
              <a
                href={`https://github.com/${repoData.owner}/${repoData.name}/issues/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-200 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg transition-colors shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Open Triage Issue</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleExportMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{copiedReport ? 'Copied Markdown!' : 'Export Report'}</span>
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="p-16 text-center rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-sm font-medium text-zinc-300">Loading Contract Drift Reports...</p>
            <p className="text-xs text-zinc-500">Querying diff history from database.</p>
          </div>
        )}

        {/* Empty State: No drift checks yet */}
        {!loading && (!reports || reports.length === 0) && (
          <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-950 space-y-4 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-cyan-400">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-white">No drift checks yet</h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
                This repository has an initial stored baseline contract (v1) and has only been analyzed once. Click <strong className="text-zinc-200">Re-check for drift</strong> after making changes in your codebase to run Phase 3&apos;s AST diff engine against the baseline.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              {!isDemo && (
                <button
                  type="button"
                  onClick={() => triggerRecheck()}
                  disabled={rechecking}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-lg shadow-md cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rechecking ? 'animate-spin' : ''}`} />
                  <span>Re-check for drift now</span>
                </button>
              )}
              <Link
                href={`/contract/${repoId}`}
                className="px-3.5 py-2 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
              >
                View living contract &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Clean State: Drift check ran and 0 diffs were found */}
        {!loading && reports.length > 0 && diffEntries.length === 0 && (
          <div className="p-10 text-center rounded-2xl border border-emerald-900/40 bg-emerald-950/15 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-white">All Endpoints Fully In Sync</h3>
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                Phase 3 diff engine compared the latest code against Baseline v{latestReport.baselineVersion}. No breaking or non-breaking schema modifications were detected.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => triggerRecheck()}
                disabled={rechecking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-emerald-300 hover:text-white bg-emerald-950/60 border border-emerald-800/80 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rechecking ? 'animate-spin' : ''}`} />
                <span>Re-scan codebase</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Diff Content */}
        {!loading && diffEntries.length > 0 && (
          <>
            {/* Severity Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Breaking Card */}
              <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/20 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-semibold flex items-center gap-1.5">
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                    Breaking Changes
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">{breakingCount}</div>
                  <p className="text-[11px] text-rose-300/80">Incompatible with existing API consumers</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-rose-400" />
                </div>
              </div>

              {/* Non-Breaking Card */}
              <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Non-Breaking Additions
                  </span>
                  <div className="text-2xl font-bold text-white font-mono">{nonBreakingCount}</div>
                  <p className="text-[11px] text-emerald-300/80">Additive, backward-compatible updates</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
              </div>

              {/* CI/CD Gate Status */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  breakingCount > 0
                    ? 'border-amber-900/40 bg-amber-950/20'
                    : 'border-emerald-900/40 bg-emerald-950/20'
                }`}
              >
                <div className="space-y-1">
                  <span
                    className={`text-[11px] font-mono uppercase tracking-wider font-semibold flex items-center gap-1.5 ${
                      breakingCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    CI/CD Merge Guard
                  </span>
                  <div
                    className={`text-sm font-bold font-mono mt-1 ${
                      breakingCount > 0 ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    {breakingCount > 0 ? 'BLOCKED (Exit 1)' : 'PASSED (Exit 0)'}
                  </div>
                  <p
                    className={`text-[11px] ${
                      breakingCount > 0 ? 'text-amber-300/80' : 'text-emerald-300/80'
                    }`}
                  >
                    {breakingCount > 0
                      ? 'Breaking changes will block PR checks'
                      : 'Safe to merge into production'}
                  </p>
                </div>
                <div
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
                    breakingCount > 0
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filter Navigation Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all cursor-pointer ${
                    filter === 'all'
                      ? 'bg-zinc-800 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  All Diffs ({diffEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('breaking')}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    filter === 'breaking'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                      : 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/30'
                  }`}
                >
                  <AlertOctagon className="w-3 h-3" />
                  <span>Breaking Only ({breakingCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('non-breaking')}
                  className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    filter === 'non-breaking'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                      : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-950/30'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Non-Breaking ({nonBreakingCount})</span>
                </button>
              </div>

              <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                Showing {filteredEntries.length} schema change(s)
              </span>
            </div>

            {/* Diff Entries List */}
            <div className="space-y-4">
              {filteredEntries.map((diff, idx) => (
                <DiffCard key={diff.path + diff.method + idx} entry={diff as any} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
