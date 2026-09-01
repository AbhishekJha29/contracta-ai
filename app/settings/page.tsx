'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  Layers,
  User as UserIcon,
  Mail,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  LogOut,
  ArrowLeft,
  KeyRound,
  Unlink,
  FolderGit2,
  Sparkles,
} from 'lucide-react';
import { FaGithub } from 'react-icons/fa';

interface UserProfile {
  id: string;
  email: string | null;
  githubId: string | null;
  githubUsername: string | null;
  hasGitHub: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update: updateSession } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const errorParam = searchParams.get('error');
  const connectedParam = searchParams.get('connected');

  useEffect(() => {
    if (errorParam === 'github_already_linked') {
      setErrorMsg('This GitHub account is already connected to another Contracta user account.');
    } else if (errorParam) {
      setErrorMsg(`Authentication error: ${errorParam}`);
    }

    if (connectedParam === 'true') {
      setSuccessMsg('GitHub account linked successfully! You can now import and monitor your repositories.');
    }
  }, [errorParam, connectedParam]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status]);

  const handleConnectGitHub = async () => {
    try {
      setConnecting(true);
      setErrorMsg(null);
      await signIn('github', { callbackUrl: '/settings' });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to initiate GitHub authorization.');
      setConnecting(false);
    }
  };

  const handleDisconnectGitHub = async () => {
    if (!confirm('Are you sure you want to disconnect your GitHub account? You will not be able to scan or sync repositories until you reconnect.')) {
      return;
    }

    try {
      setDisconnecting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await fetch('/api/auth/github/disconnect', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to disconnect GitHub account.');
      }

      setSuccessMsg('GitHub account disconnected successfully.');
      await loadProfile();
      await updateSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect GitHub account.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-400">Loading account settings...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white font-sans">Authentication Required</h2>
          <p className="text-xs text-zinc-400 font-mono">
            Please sign in with your email and password to access account settings.
          </p>
          <Link
            href="/signin"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs font-mono font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Sign In</span>
          </Link>
        </div>
      </div>
    );
  }

  const isGitHubConnected = Boolean(profile?.githubId || session?.user?.githubId);
  const githubUsername = profile?.githubUsername || session?.user?.githubUsername;
  const userEmail = profile?.email || session?.user?.email || 'No email recorded';

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-amber-500/40 p-0.5 shadow-lg shadow-amber-500/10 group-hover:border-amber-400 transition-colors">
                <div className="w-full h-full bg-[#09090b] rounded-[6px] flex items-center justify-center">
                  <Layers className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <span className="font-bold text-base tracking-tight text-white font-sans group-hover:text-amber-300 transition-colors">
                Contracta
              </span>
            </Link>
            <span className="text-zinc-600 font-mono">/</span>
            <span className="text-xs font-mono text-zinc-400 font-medium">Account Settings</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-rose-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10 w-full space-y-8 animate-in fade-in duration-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
            Account & Integrations
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Manage your primary credentials and connect developer platforms for repository analysis.
          </p>
        </div>

        {/* Notifications & Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-200 flex items-start gap-3 text-xs font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-rose-300">Connection Notice</p>
              <p className="text-rose-300/90 mt-0.5 leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-emerald-200 flex items-start gap-3 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-300">Success</p>
              <p className="text-emerald-300/90 mt-0.5 leading-relaxed">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Primary Account Info Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Primary Identity
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Email + Password Sign-In
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                Email Address
              </span>
              <div className="text-xs font-mono font-medium text-white flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-zinc-400" />
                <span>{userEmail}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                Account ID
              </span>
              <div className="text-xs font-mono font-medium text-zinc-300 truncate">
                {profile?.id || session?.user?.id || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* GitHub Integration Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <FaGithub className="w-4 h-4 text-white" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                GitHub Repository Access
              </h2>
            </div>
            {isGitHubConnected ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                Not Connected
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-300 font-sans leading-relaxed">
            GitHub connection is optional and used strictly for repository source AST ingestion, living contract generation, and automated pull request drift triage issues. Your GitHub credentials are never used for primary account authentication.
          </p>

          {isGitHubConnected ? (
            /* Connected GitHub State */
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                    <FaGithub className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">
                        @{githubUsername || 'connected-user'}
                      </span>
                      {githubUsername && (
                        <a
                          href={`https://github.com/${githubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-500 hover:text-zinc-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      Scoped for Express AST route scanning & PR check webhooks.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDisconnectGitHub}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium text-rose-400 hover:text-white bg-rose-950/30 hover:bg-rose-900/50 border border-rose-800/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{disconnecting ? 'Disconnecting...' : 'Disconnect GitHub'}</span>
                </button>
              </div>

              <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>Repository monitoring active</span>
                <Link href="/" className="text-amber-400 hover:underline flex items-center gap-1">
                  <FolderGit2 className="w-3 h-3" />
                  <span>Go to Monitored Repos &rarr;</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Unconnected GitHub State */
            <div className="p-6 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                <FaGithub className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Link Your GitHub Account
                </h3>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  Authorize read access to your public & private Express.js repositories to generate automated OpenAPI contracts and drift detection.
                </p>
              </div>

              <button
                type="button"
                onClick={handleConnectGitHub}
                disabled={connecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 border border-amber-300 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
              >
                <FaGithub className="w-4 h-4" />
                <span>{connecting ? 'Redirecting to GitHub...' : 'Connect GitHub Account'}</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
