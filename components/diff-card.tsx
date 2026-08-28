'use client';

import React, { useState } from 'react';
import { DiffEntry } from '@/lib/types';
import { MethodBadge } from './method-badge';
import {
  AlertOctagon,
  CheckCircle2,
  GitCommit,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileDiff,
  ExternalLink,
} from 'lucide-react';

export interface DiffCardProps {
  entry: DiffEntry;
}

function formatSpecValue(val: unknown, fallback: string): string {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function getRecommendation(entry: any): string | undefined {
  if (entry.suggestedFix) return entry.suggestedFix;
  const changeType = entry.changeType || '';
  if (changeType.includes('endpoint-removed')) {
    return 'Restore the endpoint handler or mark with a deprecation notice before removing to avoid breaking downstream consumers.';
  }
  if (changeType.includes('required-field-removed') || changeType.includes('response-status-removed')) {
    return 'Restore the missing property in the response schema or ensure backwards compatibility.';
  }
  if (changeType.includes('required-field-added')) {
    return 'Provide a default value (or make the new field optional) so existing API requests without this field continue to validate successfully.';
  }
  if (changeType.includes('field-type-changed')) {
    return 'Check if the schema type change was intentional. If necessary, introduce a new endpoint version or accept both types.';
  }
  if (changeType.includes('auth-added')) {
    return 'Ensure API clients are updated with valid credentials before deploying this security requirement.';
  }
  return undefined;
}

export function DiffCard({ entry }: DiffCardProps) {
  const [expanded, setExpanded] = useState(true);
  const isBreaking = entry.severity === 'breaking';

  const oldContent = formatSpecValue(entry.oldValue ?? entry.oldSpec, '// No previous specification');
  const newContent = formatSpecValue(entry.newValue ?? entry.newSpec, '// No modified specification');
  const recommendation = getRecommendation(entry);

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        isBreaking
          ? 'bg-zinc-950/90 border-rose-900/40 hover:border-rose-800/60 shadow-lg shadow-rose-950/10'
          : 'bg-zinc-950/90 border-zinc-800/80 hover:border-zinc-700/80 shadow-lg shadow-zinc-950/20'
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: isBreaking ? '#f43f5e' : '#10b981',
      }}
    >
      {/* Header Summary */}
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-850">
        <div className="flex items-start md:items-center gap-3 flex-wrap">
          {/* Severity Badge */}
          {isBreaking ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tracking-wider uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              BREAKING
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              NON-BREAKING
            </span>
          )}

          {/* Endpoint Route info */}
          <div className="flex items-center gap-2">
            <MethodBadge method={entry.method} size="sm" />
            <span className="font-mono text-sm font-semibold text-white tracking-tight">
              {entry.path}
            </span>
          </div>

          {entry.changeType && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
              type: <span className="text-zinc-200">{entry.changeType}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          {entry.timestamp && (
            <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1 mr-1">
              <Clock className="w-3 h-3" />
              {entry.timestamp}
            </span>
          )}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition-colors flex items-center gap-1 text-xs cursor-pointer"
          >
            <FileDiff className="w-3.5 h-3.5" />
            <span>{expanded ? 'Collapse Diff' : 'View Diff'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3 bg-zinc-900/30 border-b border-zinc-850">
        <p className="text-sm font-medium text-zinc-200">
          {entry.description}
        </p>
      </div>

      {/* Git Diff Code Section */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Side by side / Unified Code Diff block */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs shadow-inner">
            <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <GitCommit className="w-3.5 h-3.5 text-zinc-500" />
                <span>OpenAPI Specification Comparison</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                Unified Diff
              </span>
            </div>

            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 divide-y md:divide-y-0 md:divide-x divide-zinc-850">
              {/* Old Spec Box */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1 pb-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500/80" />
                  Baseline (Production)
                </div>
                <pre className="text-zinc-400 text-[11px] leading-relaxed overflow-x-auto p-2.5 rounded bg-zinc-900/40 border border-zinc-850">
                  <code>{oldContent}</code>
                </pre>
              </div>

              {/* New Spec Box */}
              <div className="space-y-1 md:pl-3 pt-3 md:pt-0">
                <div className="text-[10px] font-mono text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1 pb-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                  Proposed Change (Head AST)
                </div>
                <pre className="text-zinc-300 text-[11px] leading-relaxed overflow-x-auto p-2.5 rounded bg-zinc-900/40 border border-zinc-850">
                  <code>{newContent}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Suggested Fix / Advice */}
          {recommendation && (
            <div
              className={`p-3 rounded-lg border flex items-start gap-2.5 text-xs ${
                isBreaking
                  ? 'bg-rose-950/20 border-rose-900/30 text-rose-200'
                  : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-200'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Automated Recommendation:</span>
                <p className="text-zinc-300 font-sans leading-relaxed">{recommendation}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
