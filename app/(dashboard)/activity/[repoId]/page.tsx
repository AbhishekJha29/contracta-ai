'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { mockActivityEvents } from '@/lib/mock-data';
import { Topbar } from '@/components/topbar';
import {
  Activity,
  AlertTriangle,
  GitPullRequest,
  CheckCircle2,
  ExternalLink,
  GitCommit,
  Clock,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  Layers,
  Flame,
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'drift' | 'sync' | 'pr_check';
  title: string;
  description: string;
  createdAt: string;
  relativeTime: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
  issueUrl?: string | null;
  version?: number;
}

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

export default function ActivityPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const resolvedParams = use(params);
  const repoId = resolvedParams.repoId || 'demo';
  const isDemo = repoId === 'demo';

  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [repoData, setRepoData] = useState<any>(null);
  const [events, setEvents] = useState<TimelineEvent[]>(isDemo ? (mockActivityEvents as any) : []);
  const [activeFilter, setActiveFilter] = useState<'all' | 'drift' | 'sync'>('all');

  const loadActivityData = async () => {
    if (isDemo) {
      setEvents(mockActivityEvents as any);
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
          throw new Error(`Access denied: You do not have permission to view activity logs for "${repoId}".`);
        }
        throw new Error(`Failed to load repository details (${res.status})`);
      }
      const data = await res.json();
      const repo = data.repo;
      setRepoData(repo);

      const timeline: TimelineEvent[] = [];

      // 1. Map Baseline rows to timeline entries
      if (repo?.baselines) {
        for (const b of repo.baselines) {
          timeline.push({
            id: `baseline-${b.id}`,
            type: 'sync',
            title: `New contract generated — v${b.version}`,
            description: `Living OpenAPI 3.0 specification successfully extracted and published for branch "${repo.defaultBranch}".`,
            createdAt: b.createdAt,
            relativeTime: formatRelativeTime(b.createdAt),
            severity: 'success',
            version: b.version,
          });
        }
      }

      // 2. Map DriftReport rows to timeline entries
      if (repo?.driftReports) {
        for (const d of repo.driftReports) {
          const diffEntries = (d.diffJson as any[]) || [];
          const breakingCount = diffEntries.filter((e) => e.severity === 'breaking').length;
          const nonBreakingCount = diffEntries.filter((e) => e.severity === 'non-breaking').length;
          const isClean = d.severity === 'clean' || diffEntries.length === 0;

          timeline.push({
            id: `drift-${d.id}`,
            type: 'drift',
            title: isClean
              ? 'Drift check — clean'
              : `Drift check — ${d.severity}, ${breakingCount} breaking change${breakingCount === 1 ? '' : 's'}`,
            description: isClean
              ? `Compared against Baseline v${d.baselineVersion}. All endpoint schemas and routes are fully backward-compatible.`
              : `Compared against Baseline v${d.baselineVersion}. Detected ${breakingCount} breaking and ${nonBreakingCount} non-breaking schema modification(s).`,
            createdAt: d.createdAt,
            relativeTime: formatRelativeTime(d.createdAt),
            severity: isClean ? 'success' : 'critical',
            issueUrl: d.githubIssueUrl,
          });
        }
      }

      // 3. Sort descending by createdAt
      timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setEvents(timeline);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivityData();
  }, [repoId]);

  const filteredEvents = events.filter((event) => {
    if (activeFilter === 'all') return true;
    return event.type === activeFilter;
  });

  const getEventIcon = (type: string, severity?: string) => {
    switch (type) {
      case 'drift':
        return severity === 'critical' ? (
          <Flame className="w-4 h-4 text-rose-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        );
      case 'sync':
        return <Layers className="w-4 h-4 text-cyan-400" />;
      default:
        return <Activity className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getSeverityBadge = (severity?: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'warning':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'success':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar currentSection="activity" repoId={repoId} />

      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {repoData ? `${repoData.owner}/${repoData.name} — Activity Log` : 'Activity & Audit Trail'}
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                Real Audit Trail
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Audit log of AST baseline generations, drift checks, and schema revisions.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-zinc-900/60 p-1 rounded-lg border border-zinc-800 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-zinc-800 text-white font-medium shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('drift')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                activeFilter === 'drift'
                  ? 'bg-zinc-800 text-rose-300 font-medium shadow-xs'
                  : 'text-zinc-400 hover:text-rose-300'
              }`}
            >
              Drift Checks
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('sync')}
              className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer ${
                activeFilter === 'sync'
                  ? 'bg-zinc-800 text-cyan-300 font-medium shadow-xs'
                  : 'text-zinc-400 hover:text-cyan-300'
              }`}
            >
              Baseline Syncs
            </button>
          </div>
        </div>

        {/* Full error state if repo cannot be loaded */}
        {!loading && error && !repoData && !isDemo && (
          <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-950 space-y-4 max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
              <Activity className="w-7 h-7" />
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
                href="/activity/demo"
                className="px-4 py-2 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 rounded-lg transition-colors"
              >
                View Demo Activity
              </Link>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-16 text-center rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-sm font-medium text-zinc-300">Loading Activity History...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && events.length === 0 && (
          <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-950 space-y-3 max-w-md mx-auto">
            <Activity className="w-8 h-8 text-zinc-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No activity records yet</h3>
            <p className="text-xs text-zinc-400">
              Run AST analysis or drift checks on this repository to begin generating an audit trail.
            </p>
            <Link
              href={`/contract/${repoId}`}
              className="inline-flex items-center gap-1 mt-2 text-xs font-mono text-cyan-400 hover:underline"
            >
              Go to contract &rarr;
            </Link>
          </div>
        )}

        {/* Timeline Log */}
        {!loading && events.length > 0 && (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-800">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative group">
                {/* Timeline Marker Dot */}
                <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-zinc-950 border-2 border-zinc-700 flex items-center justify-center group-hover:border-cyan-400 transition-colors shadow-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 group-hover:bg-cyan-400 transition-colors" />
                </div>

                {/* Event Card */}
                <div className="p-4 rounded-xl border border-zinc-800/90 bg-zinc-950/80 hover:border-zinc-700/80 transition-all space-y-2.5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Event Type Icon badge */}
                      <div className="p-1 rounded bg-zinc-900 border border-zinc-800">
                        {getEventIcon(event.type, event.severity)}
                      </div>

                      {/* Title */}
                      <span className="text-sm font-semibold text-white">
                        {event.title}
                      </span>

                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${getSeverityBadge(
                          event.severity
                        )}`}
                      >
                        {event.severity}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {event.relativeTime}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    {event.description}
                  </p>

                  {/* Metadata Footer */}
                  <div className="pt-2 border-t border-zinc-850 flex items-center justify-between text-xs text-zinc-500 font-mono flex-wrap gap-2">
                    <span className="text-[11px] text-zinc-500">
                      Timestamp: {new Date(event.createdAt).toLocaleString()}
                    </span>

                    {event.issueUrl && (
                      <a
                        href={event.issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <span>View GitHub Issue</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
