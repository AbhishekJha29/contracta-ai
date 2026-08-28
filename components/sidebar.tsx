'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import {
  FileCode2,
  GitCompare,
  Activity,
  ChevronDown,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  GitBranch,
  LogOut,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { mockRepo } from '@/lib/mock-data';

interface SidebarProps {
  repoId?: string;
}

export function Sidebar({ repoId = 'demo' }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Extract repoId dynamically from URL pathname if present
  const pathSegments = pathname.split('/').filter(Boolean);
  const activeRepoId = (pathSegments.length >= 2 ? pathSegments[1] : repoId) || 'demo';
  const isDemo = activeRepoId === 'demo';

  const [repoData, setRepoData] = useState<any>(null);

  useEffect(() => {
    if (!isDemo && activeRepoId) {
      fetch(`/api/repos/${activeRepoId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.repo) setRepoData(data.repo);
        })
        .catch(() => {});
    }
  }, [activeRepoId, isDemo]);

  const latestDrift = repoData?.driftReports?.[0];
  const isBreaking = latestDrift?.severity === 'breaking';
  const isClean = latestDrift?.severity === 'clean';
  const diffEntries = (latestDrift?.diffJson as any[]) || [];
  const breakingCount = isDemo ? mockRepo.breakingChangesCount : diffEntries.filter((d) => d.severity === 'breaking').length;

  const repoName = repoData ? `${repoData.owner}/${repoData.name}` : isDemo ? mockRepo.name : 'Repository';
  const branchName = repoData?.defaultBranch || mockRepo.branch;

  const navItems = [
    {
      label: 'API Contract',
      href: `/contract/${activeRepoId}`,
      icon: FileCode2,
      description: 'Living endpoints & schemas',
      badge: repoData?.baselines?.[0] ? `v${repoData.baselines[0].version}` : isDemo ? `${mockRepo.totalRoutes} routes` : undefined,
      badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    },
    {
      label: 'Drift & Diff',
      href: `/drift/${activeRepoId}`,
      icon: GitCompare,
      description: 'Breaking change detection',
      badge: isDemo
        ? `${mockRepo.breakingChangesCount} breaking`
        : latestDrift
        ? isBreaking
          ? `${breakingCount} breaking`
          : 'Clean'
        : 'Baseline',
      badgeColor: isDemo || isBreaking
        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-semibold'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      label: 'Activity & Audit',
      href: `/activity/${activeRepoId}`,
      icon: Activity,
      description: 'Timeline & automated issues',
      badge: 'Live',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md flex flex-col shrink-0 h-screen sticky top-0 text-zinc-300">
      {/* Brand Header */}
      <div className="p-4 border-b border-zinc-800/80">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all">
            <div className="w-full h-full bg-zinc-950 rounded-[7px] flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                Contracta
              </span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 rounded">
                SaaS
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-tight">API Contract Guardian</p>
          </div>
        </Link>
      </div>

      {/* Active Repo Switcher */}
      <div className="p-3 border-b border-zinc-800/60">
        <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all group">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Target Repo</span>
            {isDemo || isBreaking ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                Breaking Drift
              </span>
            ) : isClean ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Clean
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
                Baseline v{repoData?.baselines?.[0]?.version ?? 1}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FaGithub className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-xs font-mono font-medium text-white truncate group-hover:text-zinc-200">
                {repoName}
              </span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-zinc-400" />
              {branchName}
            </span>
            <span>{repoData ? `v${repoData.baselines?.[0]?.version ?? 1} Spec` : mockRepo.commit}</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-2 pb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
          Inspection Views
        </div>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-zinc-800/90 text-white border border-zinc-700/80 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-zinc-500 group-hover:text-zinc-300'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Summary Pill */}
      {isBreaking || isDemo ? (
        <div className="p-3 mx-3 mb-3 rounded-lg bg-rose-950/20 border border-rose-900/30">
          <div className="flex items-center gap-2 text-rose-300 text-xs font-medium mb-1">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Breaking Drift Found</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {breakingCount} schema modification(s) require review before merging.
          </p>
          <Link
            href={`/drift/${activeRepoId}`}
            className="mt-2 text-[11px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
          >
            Review diff now &rarr;
          </Link>
        </div>
      ) : isClean ? (
        <div className="p-3 mx-3 mb-3 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-medium mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Contract In Sync</span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            All endpoints match the verified API baseline.
          </p>
        </div>
      ) : null}

      {/* Footer Navigation & User Account */}
      <div className="p-3 border-t border-zinc-800/80 space-y-2">
        <Link
          href="/"
          className="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition-colors"
        >
          <span>Switch Repository</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
        </Link>
        {repoData && (
          <a
            href={`https://github.com/${repoData.owner}/${repoData.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <FaGithub className="w-3.5 h-3.5" />
              GitHub Repository
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500" />
          </a>
        )}

        {session?.user && (
          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  width={24}
                  height={24}
                  className="rounded-full ring-1 ring-zinc-700"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                  {session.user.name?.[0] || 'U'}
                </div>
              )}
              <span className="text-xs font-medium text-zinc-300 truncate">
                {session.user.name || 'User'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
