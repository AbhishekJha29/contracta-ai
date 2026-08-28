'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { mockRepo } from '@/lib/mock-data';

interface TopbarProps {
  currentSection: 'contract' | 'drift' | 'activity';
  repoId?: string;
}

export function Topbar({ currentSection, repoId = 'demo' }: TopbarProps) {
  const isDemo = repoId === 'demo';
  const [repoData, setRepoData] = useState<any>(null);

  useEffect(() => {
    if (!isDemo && repoId) {
      fetch(`/api/repos/${repoId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.repo) setRepoData(data.repo);
        })
        .catch(() => {});
    }
  }, [repoId, isDemo]);

  const repoName = repoData ? `${repoData.owner}/${repoData.name}` : isDemo ? mockRepo.name : 'Repository';
  const branchName = repoData?.defaultBranch || mockRepo.branch;
  const githubUrl = repoData ? `https://github.com/${repoData.owner}/${repoData.name}` : mockRepo.githubUrl;

  const latestDrift = repoData?.driftReports?.[0];
  const isBreaking = latestDrift?.severity === 'breaking';
  const isClean = latestDrift?.severity === 'clean';
  const diffEntries = (latestDrift?.diffJson as any[]) || [];
  const breakingCount = isDemo ? mockRepo.breakingChangesCount : diffEntries.filter((d) => d.severity === 'breaking').length;

  return (
    <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Link href="/" className="hover:text-white transition-colors">
            repos
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-200 font-semibold truncate max-w-[200px]">{repoName}</span>
          <span className="text-zinc-600">/</span>
          <span className="text-cyan-400 font-medium">{currentSection}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-3 border-l border-zinc-800">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300">
            <GitBranch className="w-3 h-3 text-zinc-500" />
            {branchName}
          </span>
          {isDemo || isBreaking ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <Flame className="w-3 h-3 text-rose-400" />
              {breakingCount} Breaking Drift Detected
            </span>
          ) : isClean ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Contract In Sync
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
              Baseline v{repoData?.baselines?.[0]?.version ?? 1}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2.5">
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 rounded-md transition-colors"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3 text-zinc-500" />
        </a>
      </div>
    </header>
  );
}
