'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  Layers,
  ArrowRight,
  Code2,
  Activity,
  LogOut,
  User as UserIcon,
  Sparkles,
  Search,
  Lock,
  Globe,
  RefreshCw,
  FolderGit2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Flame,
  GitPullRequest,
  Terminal,
  FileCode2,
  GitCompare,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  ShieldCheck,
  Cpu,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { FaGithub } from 'react-icons/fa';
import { GitHubRepoSummary } from '@/lib/github/listRepos';
import { MethodBadge } from '@/components/method-badge';
import { previewRoutes, previewDiffs } from '@/lib/demo/previewData';

interface DashboardStats {
  totalRepos: number;
  totalChecks: number;
  cleanRepos: number;
  breakingRepos: number;
}

// Mock pipeline steps for the live terminal animation
const PIPELINE_STEPS = [
  {
    phase: '01/INGEST',
    badge: 'WEBHOOK',
    badgeColor: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    title: 'Incoming push event acknowledged',
    detail: 'refs/heads/main @ commit c9f4d1e (repo: acme/billing-service)',
    timestamp: '00:00:01',
    status: 'done',
  },
  {
    phase: '02/PARSE',
    badge: 'AST ENGINE',
    badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
    title: 'Static ts-morph AST analysis complete',
    detail: '6 Express route declarations & 14 TypeScript DTO schemas discovered',
    timestamp: '00:00:02',
    status: 'done',
  },
  {
    phase: '03/SPEC',
    badge: 'OPENAPI 3.0',
    badgeColor: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80',
    title: 'Living OpenAPI contract snapshot compiled',
    detail: 'Baseline v4 generated with 6 endpoints, query params, & responses',
    timestamp: '00:00:03',
    status: 'done',
  },
  {
    phase: '04/DIFF',
    badge: 'DRIFT DETECTED',
    badgeColor: 'bg-rose-950/70 text-rose-300 border-rose-800/80',
    title: 'Semantic schema diff evaluated against Baseline v3',
    detail: '2 breaking changes isolated: field "email" removed on GET /v1/customers/:id',
    timestamp: '00:00:04',
    status: 'alert',
  },
  {
    phase: '05/GUARD',
    badge: 'TRIAGE OPENED',
    badgeColor: 'bg-amber-950/80 text-amber-400 border-amber-700/80',
    title: 'Automated GitHub triage issue #12 dispatched',
    detail: 'CI merge guard flagged breaking drift • Exit code 1 (PR #84 blocked)',
    timestamp: '00:00:05',
    status: 'alert',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isAuthenticated = status === 'authenticated' && !!session?.user;
  const isAuthLoading = status === 'loading';

  // State for authenticated workspace
  const [userRepos, setUserRepos] = useState<GitHubRepoSummary[]>([]);
  const [connectedRepos, setConnectedRepos] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRepos: 0,
    totalChecks: 0,
    cleanRepos: 0,
    breakingRepos: 0,
  });
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<number | string>('');
  const [repoSearch, setRepoSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Live Terminal interactive animation step index
  const [visibleStepCount, setVisibleStepCount] = useState(PIPELINE_STEPS.length);
  const [isSimulating, setIsSimulating] = useState(false);

  // Static Preview Section State
  const [activePreviewTab, setActivePreviewTab] = useState<'contract' | 'drift'>('contract');
  const [expandedPreviewRoutes, setExpandedPreviewRoutes] = useState<Record<string, boolean>>({
    'route-2': true,
    'route-3': true,
  });

  // Staggered terminal step animation runner
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      setVisibleStepCount(1);
      let current = 1;
      interval = setInterval(() => {
        current++;
        if (current <= PIPELINE_STEPS.length) {
          setVisibleStepCount(current);
        } else {
          setIsSimulating(false);
          clearInterval(interval);
        }
      }, 750);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  // Fetch repositories once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchRepositories();
      fetchConnectedRepositories();
    }
  }, [isAuthenticated]);

  const fetchRepositories = async () => {
    try {
      setLoadingRepos(true);
      setError(null);
      const res = await fetch('/api/github/repos');
      const data = await res.json();

      if (res.ok && data.repos) {
        setUserRepos(data.repos);
        if (data.repos.length > 0) {
          setSelectedRepoId(data.repos[0].id);
        }
      } else {
        setError(data.error || 'Failed to load GitHub repositories.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching repositories.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const fetchConnectedRepositories = async () => {
    try {
      const res = await fetch('/api/repos');
      const data = await res.json();
      if (res.ok && data.repos) {
        setConnectedRepos(data.repos);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleConnectRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) return;

    const chosen = userRepos.find((r) => String(r.id) === String(selectedRepoId));
    if (!chosen) return;

    try {
      setConnecting(true);
      setError(null);

      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepoId: String(chosen.id),
          owner: chosen.owner,
          name: chosen.name,
          defaultBranch: chosen.defaultBranch || 'main',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to connect repository.');
      }

      router.push(`/contract/${data.repo.id}`);
    } catch (err: any) {
      setError(err.message || 'Error connecting repository.');
      setConnecting(false);
    }
  };

  const filteredUserRepos = userRepos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(repoSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-amber-500/25 selection:text-amber-200">
      {/* Main Header */}
      <header className="border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand Wordmark */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-amber-500/40 p-0.5 shadow-lg shadow-amber-500/10 group-hover:border-amber-400 transition-colors">
              <div className="w-full h-full bg-[#09090b] rounded-[6px] flex items-center justify-center">
                <Layers className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white font-sans group-hover:text-amber-300 transition-colors">
                Contracta
              </span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-amber-950/40 text-amber-300 border border-amber-800/60 rounded">
                v1.0
              </span>
            </div>
          </Link>

          {/* Nav links (Logged-out) */}
          {!isAuthenticated && (
            <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-zinc-400">
              <a href="#pipeline" className="hover:text-amber-400 transition-colors">
                // Pipeline
              </a>
              <a href="#architecture" className="hover:text-amber-400 transition-colors">
                // Architecture
              </a>
              <a href="#preview" className="hover:text-amber-400 transition-colors">
                // Preview
              </a>
              <a href="#capabilities" className="hover:text-amber-400 transition-colors">
                // Capabilities
              </a>
              <Link href="/contract/demo" className="text-zinc-300 hover:text-white transition-colors">
                Demo Sandbox
              </Link>
            </nav>
          )}

          {/* Auth State Button */}
          <div className="flex items-center gap-3">
            {isAuthLoading ? (
              <div className="h-8 w-24 bg-zinc-900 border border-zinc-800 animate-pulse rounded-lg" />
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800">
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      width={20}
                      height={20}
                      className="rounded-full ring-1 ring-amber-500/40"
                    />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span className="text-xs font-mono text-zinc-200 hidden sm:inline-block max-w-[120px] truncate">
                    {session.user?.name || session.user?.email || 'Authenticated'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn('github')}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-mono font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 border border-amber-300 rounded-lg transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <FaGithub className="w-3.5 h-3.5" />
                <span>Sign in with GitHub</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace / Landing Flow */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-20 w-full space-y-24">
        {isAuthenticated ? (
          /* ====================================================================
             AUTHENTICATED WORKSPACE DASHBOARD
             ==================================================================== */
          <section className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-200">
            {/* Header & Sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                    Monitored Repository Workspace
                  </h1>
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  Live OpenAPI contracts, background workers, and AST drift detection history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  fetchRepositories();
                  fetchConnectedRepositories();
                }}
                disabled={loadingRepos}
                className="text-xs font-mono text-zinc-400 hover:text-amber-400 inline-flex items-center gap-1.5 self-start sm:self-auto bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
                <span>Sync GitHub Repos</span>
              </button>
            </div>

            {/* Real DB Usage Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-zinc-800/90 bg-zinc-900/50 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">
                  Connected Repos
                </span>
                <div className="text-2xl font-bold text-white font-mono">{stats.totalRepos}</div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800/90 bg-zinc-900/50 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">
                  Drift Checks Run
                </span>
                <div className="text-2xl font-bold text-amber-400 font-mono">{stats.totalChecks}</div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-900/40 bg-emerald-950/20 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Clean Repos
                </span>
                <div className="text-2xl font-bold text-emerald-300 font-mono">{stats.cleanRepos}</div>
              </div>

              <div className="p-4 rounded-xl border border-rose-900/40 bg-rose-950/20 space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-medium flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  Breaking Drift
                </span>
                <div className="text-2xl font-bold text-rose-300 font-mono">{stats.breakingRepos}</div>
              </div>
            </div>

            {/* Connect Repository Form */}
            <form
              onSubmit={handleConnectRepo}
              className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-2xl text-left space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Connect GitHub Repository
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-500">Auto Push Webhooks Enabled</span>
              </div>

              {error && (
                <p className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-900/50 font-mono">
                  {error}
                </p>
              )}

              {loadingRepos ? (
                <div className="p-8 text-center space-y-2 text-zinc-400">
                  <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs font-mono">Fetching accessible repositories from GitHub API...</p>
                </div>
              ) : userRepos.length === 0 ? (
                <div className="p-6 text-center text-zinc-400 text-xs font-mono">
                  <p>No repositories discovered under this GitHub account.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search Filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Filter repos by name (e.g. billing-service)..."
                      className="w-full bg-[#09090b] border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500/80 transition-colors"
                    />
                  </div>

                  {/* Dropdown */}
                  <div className="relative">
                    <select
                      value={selectedRepoId}
                      onChange={(e) => setSelectedRepoId(e.target.value)}
                      className="w-full bg-[#09090b] border border-zinc-800 rounded-xl px-3.5 py-3 text-xs font-mono text-white focus:outline-hidden focus:border-amber-500 transition-colors appearance-none cursor-pointer"
                    >
                      {filteredUserRepos.map((r) => (
                        <option key={r.id} value={r.id} className="bg-zinc-950 py-1">
                          {r.fullName} {r.private ? '🔒 (Private)' : '🌐 (Public)'} [branch: {r.defaultBranch}]
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <button
                    type="submit"
                    disabled={connecting || !selectedRepoId}
                    className="w-full py-3 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {connecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Connecting & Installing Push Webhook...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect Repository & Extract Living Contract</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>

            {/* List of Monitored Repositories */}
            <div className="space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Monitored Repositories ({connectedRepos.length})
              </span>

              {connectedRepos.length === 0 ? (
                <div className="p-8 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-center space-y-2 text-zinc-400">
                  <FolderGit2 className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-mono">No repositories monitored yet. Select a repo above to initiate analysis.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedRepos.map((repo) => {
                    const latestDrift = repo.driftReports?.[0];
                    const isBreaking = latestDrift?.severity === 'breaking';

                    return (
                      <Link
                        key={repo.id}
                        href={`/contract/${repo.id}`}
                        className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-amber-500/40 text-xs transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FaGithub className="w-4 h-4 text-zinc-400 shrink-0 group-hover:text-amber-400 transition-colors" />
                          <div>
                            <span className="font-mono text-zinc-200 font-semibold truncate group-hover:text-amber-300 block">
                              {repo.owner}/{repo.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              Monitored Branch: {repo.defaultBranch || 'main'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {latestDrift ? (
                            isBreaking ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full font-semibold flex items-center gap-1">
                                <Flame className="w-3 h-3 text-rose-400" />
                                🚨 Breaking Drift
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                ✅ In Sync
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full">
                              Baseline v{repo.baselines?.[0]?.version ?? 1}
                            </span>
                          )}

                          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : (
          /* ====================================================================
             LOGGED-OUT TECHNICAL PRODUCT LANDING PAGE
             ==================================================================== */
          <>
            {/* HERO SECTION */}
            <section className="text-center space-y-8 max-w-4xl mx-auto pt-4 sm:pt-8">
              {/* Eyebrow Chip */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-amber-500/30 text-xs text-zinc-300 shadow-inner">
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-mono text-[11px] text-amber-300 uppercase font-semibold">
                  Zero-Runtime API Governance
                </span>
                <span className="text-zinc-600 font-mono">/</span>
                <span className="text-zinc-400 font-mono text-[11px]">Continuous AST Surveillance</span>
              </div>

              {/* Main Headline (Original, High-Impact) */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-tight font-sans">
                Know your API broke <br />
                <span className="text-amber-400 underline decoration-amber-500/30 underline-offset-8">
                  before your users do.
                </span>
              </h1>

              {/* Sub-headline */}
              <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-sans">
                Contracta statically inspects Express & TypeScript route definitions, compiles living OpenAPI contracts directly from your source AST, and halts breaking API drift before it reaches production.
              </p>

              {/* CTA Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => signIn('github')}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <FaGithub className="w-4 h-4 text-zinc-950" />
                  <span>Connect GitHub Repository</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <Link
                  href="/contract/demo"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-mono text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Explore Demo Sandbox &rarr;</span>
                </Link>
              </div>

              {/* Trust Badge */}
              <div className="pt-2 text-[11px] font-mono text-zinc-500">
                <span>⚡ Ephemeral AST Processing • No Code Stored Permanently • OAuth 2.0</span>
              </div>
            </section>

            {/* LIVE INTELLIGENCE TERMINAL / PIPELINE VISUALIZER */}
            <section id="pipeline" className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-zinc-200">LIVE ENGINE PIPELINE VISUALIZER</span>
                  <span className="text-zinc-600">//</span>
                  <span className="text-zinc-500">TARGET: acme/billing-service@main</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSimulating(true)}
                  disabled={isSimulating}
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <RotateCcw className={`w-3 h-3 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>{isSimulating ? 'Simulating Scan...' : 'Replay Pipeline Scan'}</span>
                </button>
              </div>

              {/* Terminal Frame */}
              <div className="rounded-2xl border border-zinc-800 bg-[#0c0d10] shadow-2xl overflow-hidden font-mono text-xs">
                {/* Terminal Header Bar */}
                <div className="px-4 py-3 bg-[#111216] border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="text-zinc-400 text-[11px] ml-2 font-mono">
                      contracta-worker :: process-analysis-job [job-9281a]
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/80">
                      TELEMETRY FEED
                    </span>
                  </div>
                </div>

                {/* Pipeline Step Sequence Output */}
                <div className="p-5 sm:p-6 space-y-3.5 overflow-x-auto bg-[#09090b]/90">
                  {PIPELINE_STEPS.slice(0, visibleStepCount).map((step, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all animate-in fade-in slide-in-from-left-2 duration-300 ${
                        step.status === 'alert'
                          ? 'border-rose-900/50 bg-rose-950/15'
                          : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-zinc-500 font-mono text-[11px]">[{step.timestamp}]</span>
                          <span className="font-mono text-amber-400 font-semibold">{step.phase}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${step.badgeColor}`}
                          >
                            {step.badge}
                          </span>
                          <span className="text-zinc-200 font-medium">{step.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                          {step.status === 'alert' ? 'STATUS: DRIFT_DETECTED' : 'STATUS: SUCCESS'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-zinc-400 text-[11px] pl-0 sm:pl-16 font-sans">
                        &rarr; <code className="text-zinc-300 font-mono">{step.detail}</code>
                      </p>
                    </div>
                  ))}

                  {/* Terminal Cursor Line */}
                  <div className="flex items-center gap-2 text-zinc-400 pt-2 text-[11px]">
                    <span className="text-amber-400 font-bold">$</span>
                    <span className="text-zinc-300">contracta monitoring daemon awaiting next push webhook payload</span>
                    <span className="w-2 h-4 bg-amber-400 animate-cursor inline-block" />
                  </div>
                </div>
              </div>
            </section>

            {/* REAL-TIME SCHEMA DRIFT COMPARISON CARD */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                  <GitCompare className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-zinc-200">AST DIFF ENGINE SPECIMEN</span>
                  <span className="text-zinc-600">//</span>
                  <span className="text-zinc-500">BASELINE v3 vs LATEST PUSH v4</span>
                </div>
                <Link
                  href="/drift/demo"
                  className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <span>Open Full Diff Inspector &rarr;</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono text-xs">
                {/* Breaking Change Card */}
                <div className="p-5 rounded-2xl border border-rose-900/60 bg-rose-950/15 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      🚨 BREAKING DRIFT DETECTED
                    </span>
                    <span className="text-[11px] text-zinc-400">GET /v1/customers/:id</span>
                  </div>
                  <p className="text-zinc-200 font-sans text-xs">
                    Required field <code className="text-rose-400 font-mono">&quot;email&quot;</code> removed from CustomerResponse DTO.
                  </p>
                  <div className="p-3 rounded-lg bg-[#09090b] border border-rose-950 text-rose-300 space-y-1 text-[11px]">
                    <div className="text-zinc-500">// Schema: CustomerResponse (v3.0 &rarr; v4.0)</div>
                    <div>- &quot;email&quot;: &quot;sarah.j@example.com&quot;  // [REQUIRED FIELD REMOVED]</div>
                    <div className="text-rose-500/80">// Uncaught client runtime error in SDK v1.2</div>
                  </div>
                </div>

                {/* Non-Breaking Change Card */}
                <div className="p-5 rounded-2xl border border-emerald-900/50 bg-emerald-950/15 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✅ NON-BREAKING (BACKWARD-COMPATIBLE)
                    </span>
                    <span className="text-[11px] text-zinc-400">POST /v1/subscriptions</span>
                  </div>
                  <p className="text-zinc-200 font-sans text-xs">
                    New optional field <code className="text-emerald-400 font-mono">&quot;tax_rate&quot;</code> added to response schema.
                  </p>
                  <div className="p-3 rounded-lg bg-[#09090b] border border-emerald-950 text-emerald-300 space-y-1 text-[11px]">
                    <div className="text-zinc-500">// Schema: SubscriptionResponse (v3.0 &rarr; v4.0)</div>
                    <div>+ &quot;tax_rate&quot;: 0.0825  // [OPTIONAL PROPERTY ADDED]</div>
                    <div className="text-emerald-500/80">// Backward-compatible with existing consumers</div>
                  </div>
                </div>
              </div>
            </section>

            {/* HOW CONTRACTA WORKS (Numbered Sequential Pipeline) */}
            <section id="architecture" className="space-y-12">
              <div className="text-center space-y-3 max-w-2xl mx-auto">
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">
                  Architectural Pipeline
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-sans">
                  How Contracta Guards Your API
                </h2>
                <p className="text-sm text-zinc-400 font-sans">
                  Deterministic AST analysis operating continuously between your git pushes and production releases.
                </p>
              </div>

              {/* 5-Node Vertical / Horizontal Sequential Grid */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
                {/* Node 1 */}
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-amber-400 font-mono font-bold text-sm">01 // INGEST</div>
                    <h3 className="text-sm font-semibold text-white font-sans">Connect Repo</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      Authenticate via GitHub OAuth. Contracta automatically configures push webhooks on your target branch.
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 bg-zinc-950 text-zinc-300 border border-zinc-800 rounded">
                      Webhook: Push Active
                    </span>
                  </div>
                </div>

                {/* Node 2 */}
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-amber-400 font-mono font-bold text-sm">02 // PARSE</div>
                    <h3 className="text-sm font-semibold text-white font-sans">AST Route Parse</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      <code className="text-amber-300 font-mono">ts-morph</code> statically walks Express route handlers and TypeScript schemas without executing code.
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 bg-zinc-950 text-amber-400/90 border border-amber-900/50 rounded">
                      AST: 100% Static
                    </span>
                  </div>
                </div>

                {/* Node 3 */}
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-amber-400 font-mono font-bold text-sm">03 // SPEC</div>
                    <h3 className="text-sm font-semibold text-white font-sans">Living OpenAPI</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      Compiles verified OpenAPI 3.0 specification baselines with parameters, JSON schemas, and responses.
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 bg-zinc-950 text-cyan-400 border border-cyan-900/50 rounded">
                      Spec: OpenAPI 3.0.3
                    </span>
                  </div>
                </div>

                {/* Node 4 */}
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-amber-400 font-mono font-bold text-sm">04 // DIFF</div>
                    <h3 className="text-sm font-semibold text-white font-sans">Detect Drift</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      AST diff engine compares every commit against baseline, isolating breaking removals and type changes.
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 bg-rose-950/60 text-rose-300 border border-rose-800/80 rounded">
                      Diff: 2 Breaking
                    </span>
                  </div>
                </div>

                {/* Node 5 */}
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="text-amber-400 font-mono font-bold text-sm">05 // GUARD</div>
                    <h3 className="text-sm font-semibold text-white font-sans">Alert & CI Gate</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      Opens automated GitHub triage issues, comments on Pull Requests, and halts breaking merges in CI.
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded">
                      CI Guard: Exit 1
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* SEE CONTRACTA IN ACTION (Interactive Static Specimen Preview) */}
            <section id="preview" className="space-y-8">
              {/* Section Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800/80 pb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">
                      Live Specimen Preview
                    </span>
                    <span className="text-zinc-700">//</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                      Zero Auth Required
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
                    See Contracta In Action
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 font-sans max-w-xl">
                    Explore how living OpenAPI contracts and breaking schema diffs render in the dashboard—without connecting a repository or signing in.
                  </p>
                </div>

                {/* Honest Caption */}
                <div className="text-[11px] font-mono text-zinc-500 bg-zinc-900/60 border border-zinc-800/80 px-3 py-1.5 rounded-lg flex items-center gap-2 self-start md:self-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Example output from <code className="text-zinc-300">sample-express-app</code> (Static preview)</span>
                </div>
              </div>

              {/* Tab Selector Buttons */}
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                <button
                  type="button"
                  onClick={() => setActivePreviewTab('contract')}
                  className={`px-4 py-2 text-xs font-mono font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                    activePreviewTab === 'contract'
                      ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 bg-zinc-950 border border-zinc-800'
                  }`}
                >
                  <FileCode2 className="w-4 h-4" />
                  <span>Living Contract View (5 Endpoints)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewTab('drift')}
                  className={`px-4 py-2 text-xs font-mono font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                    activePreviewTab === 'drift'
                      ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900 bg-zinc-950 border border-zinc-800'
                  }`}
                >
                  <GitCompare className="w-4 h-4" />
                  <span>Drift Detection View (2 Changes)</span>
                </button>
              </div>

              {/* Preview Content Container */}
              <div className="rounded-2xl border border-zinc-800 bg-[#0c0d10] p-5 sm:p-6 shadow-2xl space-y-6">
                {activePreviewTab === 'contract' ? (
                  /* ==========================================================
                     TAB 1: MOCKED LIVING CONTRACT VIEW (Purely Static Client-Side)
                     ========================================================== */
                  <div className="space-y-4 font-mono text-xs">
                    {/* Simulated Header Bar inside Contract Panel */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-[11px]">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <FaGithub className="w-3.5 h-3.5 text-zinc-400" />
                          <span>sample-express-app</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/60">
                          OpenAPI 3.0.3
                        </span>
                        <span className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                          Baseline v3
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-zinc-400">
                        <span>5 endpoints discovered</span>
                        <span className="text-zinc-600">•</span>
                        <span>AST engine verified</span>
                      </div>
                    </div>

                    {/* Interactive Route Rows */}
                    <div className="space-y-2.5">
                      {previewRoutes.map((route) => {
                        const isExpanded = expandedPreviewRoutes[route.id] ?? (route.id === 'route-2' || route.id === 'route-3');

                        return (
                          <div
                            key={route.id}
                            className="rounded-xl border border-zinc-800 bg-zinc-950 hover:border-zinc-700 transition-all overflow-hidden"
                          >
                            {/* Route Collapsible Row Header */}
                            <div
                              onClick={() =>
                                setExpandedPreviewRoutes((prev) => ({
                                  ...prev,
                                  [route.id]: !isExpanded,
                                }))
                              }
                              className="p-3 flex items-center justify-between cursor-pointer select-none hover:bg-zinc-900/40 transition-colors"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <MethodBadge method={route.method} size="sm" />
                                <span className="font-bold text-white tracking-tight">{route.path}</span>
                                <span className="hidden md:inline text-zinc-400 font-sans text-xs">
                                  — {route.summary}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {route.requiresAuth ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-950/40 text-amber-300 border border-amber-800/60 rounded">
                                    <Lock className="w-3 h-3 text-amber-400" />
                                    <span className="hidden sm:inline">Bearer Auth</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded">
                                    <Globe className="w-3 h-3 text-zinc-500" />
                                    <span className="hidden sm:inline">Public</span>
                                  </span>
                                )}

                                <span className="hidden sm:inline text-[10px] px-2 py-0.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded">
                                  {route.tag}
                                </span>

                                <div className="p-1 text-zinc-400">
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="p-4 border-t border-zinc-850 bg-zinc-900/30 space-y-3.5">
                                <p className="text-xs text-zinc-300 font-sans">{route.description}</p>

                                {/* Route Params */}
                                {route.params && route.params.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                                      Parameters ({route.params.length})
                                    </span>
                                    <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 space-y-1 text-xs">
                                      {route.params.map((p, pIdx) => (
                                        <div key={pIdx} className="flex items-center justify-between text-[11px]">
                                          <div className="flex items-center gap-2">
                                            <span className="text-amber-300 font-semibold">{p.name}</span>
                                            <span className="text-zinc-500 text-[10px]">{p.type}</span>
                                            {p.required && <span className="text-rose-400 text-[10px]">required</span>}
                                          </div>
                                          <span className="text-zinc-400 text-[10px]">{p.description}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Request & Response Schema Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Request Payload */}
                                  {route.requestBody && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                                        Request Payload Schema
                                      </span>
                                      <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 space-y-1 text-[11px]">
                                        {route.requestBody.map((f, fIdx) => (
                                          <div key={fIdx} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-cyan-300">{f.field}</span>
                                              <span className="text-zinc-500 text-[10px]">{f.type}</span>
                                            </div>
                                            {f.required ? (
                                              <span className="text-rose-400 text-[10px]">required</span>
                                            ) : (
                                              <span className="text-zinc-500 text-[10px]">optional</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Response Payload */}
                                  {route.responseBody && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                                        200 Response Payload
                                      </span>
                                      <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-850 space-y-1 text-[11px]">
                                        {route.responseBody.map((r, rIdx) => (
                                          <div key={rIdx} className="flex items-center justify-between">
                                            <span className="text-emerald-300">{r.field}</span>
                                            <span className="text-zinc-500 text-[10px]">{r.type}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Status codes */}
                                <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                                  <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Responses:</span>
                                  {route.statusCodes.map((s, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className={`px-2 py-0.5 rounded border text-[10px] ${
                                        s.code < 300
                                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                                          : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                                      }`}
                                    >
                                      {s.code} — {s.description}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* ==========================================================
                     TAB 2: MOCKED DRIFT VIEW (Purely Static Client-Side)
                     ========================================================== */
                  <div className="space-y-4 font-mono text-xs">
                    {/* Severity Summary Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                      <div className="p-3.5 rounded-xl border border-rose-900/50 bg-rose-950/20 space-y-1">
                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-rose-400" />
                          Breaking Changes
                        </div>
                        <div className="text-xl font-bold text-white">1 Detected</div>
                        <p className="text-[10px] text-rose-300/80 font-sans">Incompatible with existing API consumers</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-emerald-900/40 bg-emerald-950/20 space-y-1">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Non-Breaking Additions
                        </div>
                        <div className="text-xl font-bold text-white">1 Additive</div>
                        <p className="text-[10px] text-emerald-300/80 font-sans">Backward-compatible additive updates</p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-amber-900/40 bg-amber-950/20 space-y-1">
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <GitPullRequest className="w-3.5 h-3.5" />
                          CI Merge Guard
                        </div>
                        <div className="text-xl font-bold text-amber-300">BLOCKED (Exit 1)</div>
                        <p className="text-[10px] text-amber-300/80 font-sans">Automated GitHub triage issue #12 filed</p>
                      </div>
                    </div>

                    {/* Diff Cards List */}
                    <div className="space-y-3 pt-2">
                      {previewDiffs.map((diff) => {
                        const isBreaking = diff.severity === 'breaking';

                        return (
                          <div
                            key={diff.id}
                            className={`rounded-xl border overflow-hidden transition-all text-left ${
                              isBreaking
                                ? 'bg-zinc-950 border-rose-900/50 shadow-lg shadow-rose-950/10'
                                : 'bg-zinc-950 border-zinc-800 shadow-lg'
                            }`}
                            style={{
                              borderLeftWidth: '4px',
                              borderLeftColor: isBreaking ? '#f43f5e' : '#10b981',
                            }}
                          >
                            {/* Diff Header */}
                            <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-850">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                {isBreaking ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                                    BREAKING
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    NON-BREAKING
                                  </span>
                                )}

                                <MethodBadge method={diff.method} size="sm" />
                                <span className="font-bold text-white">{diff.path}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                                  type: {diff.changeType}
                                </span>
                              </div>

                              <span className="text-[10px] text-zinc-500">{diff.timestamp}</span>
                            </div>

                            {/* Description */}
                            <div className="px-4 py-2.5 bg-zinc-900/30 border-b border-zinc-850 font-sans text-xs text-zinc-200">
                              {diff.description}
                            </div>

                            {/* Code Diff Comparison */}
                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 divide-y md:divide-y-0 md:divide-x divide-zinc-850">
                                <div className="space-y-1">
                                  <div className="text-[10px] text-rose-400 uppercase font-semibold">
                                    Baseline (Production v3)
                                  </div>
                                  <pre className="p-2.5 rounded bg-zinc-900/50 border border-zinc-850 text-zinc-400 text-[11px] leading-relaxed overflow-x-auto">
                                    <code>{diff.oldSpec}</code>
                                  </pre>
                                </div>

                                <div className="space-y-1 md:pl-3 pt-3 md:pt-0">
                                  <div className="text-[10px] text-emerald-400 uppercase font-semibold">
                                    Proposed Change (Head AST v4)
                                  </div>
                                  <pre className="p-2.5 rounded bg-zinc-900/50 border border-zinc-850 text-zinc-300 text-[11px] leading-relaxed overflow-x-auto">
                                    <code>{diff.newSpec}</code>
                                  </pre>
                                </div>
                              </div>

                              {/* Recommendation Box */}
                              <div
                                className={`p-3 rounded-lg border flex items-start gap-2 text-xs font-sans ${
                                  isBreaking
                                    ? 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                                    : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                                }`}
                              >
                                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                                <div>
                                  <span className="font-semibold block text-[11px] uppercase tracking-wider font-mono">
                                    Automated Recommendation:
                                  </span>
                                  <p className="text-zinc-300 text-xs leading-relaxed">{diff.suggestedFix}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bottom CTA within Preview Section */}
                <div className="pt-4 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-0.5 text-left">
                    <p className="text-xs font-bold text-white font-sans">
                      Ready to analyze your own Express or TypeScript repo?
                    </p>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      Extract living OpenAPI specs and prevent breaking regressions on every push.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => signIn('github')}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <FaGithub className="w-3.5 h-3.5" />
                      <span>Sign in with GitHub to analyze your own repo</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* CAPABILITY CARDS SECTION (Technical Dashboard Cards) */}
            <section id="capabilities" className="space-y-10">
              <div className="text-center space-y-3 max-w-2xl mx-auto">
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-semibold">
                  Capabilities & Specifications
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-sans">
                  Engineered for Backend API Teams
                </h2>
                <p className="text-sm text-zinc-400 font-sans">
                  Deep AST inspection with zero manual OpenAPI maintenance required.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Capability 1 */}
                <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Code2 className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
                      Latency: &lt;140ms
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white font-sans">AST Route & Schema Extraction</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      Directly parses Express endpoint registrations (<code className="text-amber-300 font-mono">router.get</code>, <code className="text-amber-300 font-mono">app.post</code>), query parameters, path variables, and TypeScript request/response DTO structures without spinning up databases or servers.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex items-center gap-4 text-[11px] font-mono text-zinc-500">
                    <span>• Zero runtime execution</span>
                    <span>• Full Express & TypeScript support</span>
                  </div>
                </div>

                {/* Capability 2 */}
                <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <FileCode2 className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
                      OpenAPI 3.0.3 Compatible
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white font-sans">Living Contract Baseline Snapshots</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      Converts your route AST into standard OpenAPI 3.0 specifications. Versioned snapshots are persisted in PostgreSQL, creating an immutable audit trail of API evolutions over time.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex items-center gap-4 text-[11px] font-mono text-zinc-500">
                    <span>• Exportable OpenAPI JSON</span>
                    <span>• Versioned baseline history</span>
                  </div>
                </div>

                {/* Capability 3 */}
                <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                      <GitCompare className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
                      2-Tier Severity Engine
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white font-sans">Semantic Breaking Drift Detection</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      Evaluates payload schemas property-by-property. Flags breaking regressions (deleted fields, altered types, new required inputs) while safely approving backward-compatible additions.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex items-center gap-4 text-[11px] font-mono text-zinc-500">
                    <span>• Field-level diffing</span>
                    <span>• Suggested remediation advice</span>
                  </div>
                </div>

                {/* Capability 4 */}
                <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
                      Redis + BullMQ Queue
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white font-sans">Automated GitHub Triage & PR Guardrails</h3>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                      Push webhooks trigger async BullMQ workers with timeout safeguards. When breaking changes are detected, Contracta automatically opens GitHub triage issues and blocks faulty PR merges in CI.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex items-center gap-4 text-[11px] font-mono text-zinc-500">
                    <span>• Automated GitHub Issues</span>
                    <span>• PR review comments & CI gate</span>
                  </div>
                </div>
              </div>
            </section>

            {/* SIGN-IN CARD SECTION */}
            <section id="sign-in" className="max-w-xl mx-auto pt-8">
              <div className="p-8 sm:p-10 rounded-3xl bg-[#0c0d10] border border-amber-500/40 shadow-2xl text-center space-y-6 relative overflow-hidden">
                {/* Subtle top amber glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-md">
                  <Layers className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white font-sans tracking-tight">
                    Start Guarding Your API Contracts
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans max-w-sm mx-auto leading-relaxed">
                    Continuous contract governance and breaking change surveillance for engineering teams.
                  </p>
                </div>

                <div className="pt-2 space-y-3">
                  <button
                    type="button"
                    onClick={() => signIn('github')}
                    className="w-full py-3.5 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    <FaGithub className="w-4 h-4 text-zinc-950" />
                    <span>Sign in with GitHub to Connect</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="text-[11px] font-mono text-zinc-500 leading-relaxed px-4">
                    🔒 We only read the repositories you choose to connect. Source code is analyzed inside isolated ephemeral worker memory and is never permanently stored on our servers.
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-800/80">
                  <Link
                    href="/contract/demo"
                    className="text-xs font-mono text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                  >
                    <span>Try interactive sandbox demo workspace without sign-in &rarr;</span>
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800/80 bg-[#09090b] py-10 text-xs font-mono text-zinc-500 mt-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-zinc-900 border border-amber-500/30 flex items-center justify-center">
              <Layers className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-zinc-300 font-bold font-sans text-sm">Contracta</span>
            <span className="text-zinc-600">//</span>
            <span>API Contract Surveillance Engine</span>
          </div>

          <div className="flex items-center gap-6 text-zinc-400">
            <Link href="/contract/demo" className="hover:text-amber-400 transition-colors">
              Sandbox
            </Link>
            <Link href="/drift/demo" className="hover:text-amber-400 transition-colors">
              Diff Engine
            </Link>
            <Link href="/activity/demo" className="hover:text-amber-400 transition-colors">
              Activity
            </Link>
            {/* Repository URL placeholder / configuration */}
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <FaGithub className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>

          <div>
            <p>&copy; {new Date().getFullYear()} Contracta SaaS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
