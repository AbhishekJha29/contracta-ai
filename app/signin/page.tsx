'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
  Layers,
  Mail,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Sparkles,
} from 'lucide-react';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const registered = searchParams.get('registered');
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  useEffect(() => {
    if (registered === 'true') {
      setSuccess('Account created successfully! Please sign in with your credentials.');
    }
  }, [registered]);

  // If already authenticated, redirect immediately to dashboard
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl);
    }
  }, [status, callbackUrl, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-zinc-400">
            {status === 'authenticated' ? 'Redirecting to workspace...' : 'Loading session...'}
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);

      const res = await signIn('credentials', {
        email: cleanEmail,
        password,
        redirect: false,
      });

      if (res?.error || (res && !res.ok)) {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
        return;
      }

      // Redirect to dashboard on successful login
      router.push(callbackUrl);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Authentication error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-center items-center px-4 py-12 selection:bg-amber-500/25 selection:text-amber-200">
      {/* Background subtle ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Logo Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-amber-500/40 p-0.5 shadow-lg shadow-amber-500/10 group-hover:border-amber-400 transition-colors">
              <div className="w-full h-full bg-[#09090b] rounded-[8px] flex items-center justify-center">
                <Layers className="w-4.5 h-4.5 text-amber-400" />
              </div>
            </div>
            <span className="font-bold text-lg tracking-tight text-white font-sans group-hover:text-amber-300 transition-colors">
              Contracta
            </span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-white font-sans">
            Sign in to your account
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Continuous AST API contract surveillance workspace
          </p>
        </div>

        {/* Card Container */}
        <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-2xl backdrop-blur-md space-y-5">
          {/* Alerts */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-emerald-300 text-xs font-mono flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@acme.corp"
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#09090b] border border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono text-white placeholder-zinc-500 focus:outline-hidden focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 pt-2.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer link to sign up */}
          <div className="pt-4 border-t border-zinc-800/80 text-center space-y-3">
            <p className="text-xs font-mono text-zinc-400">
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-4"
              >
                Sign up
              </Link>
            </p>

            <div className="pt-1">
              <Link
                href="/contract/demo"
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Explore Demo Sandbox without signing in</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Home Link */}
        <div className="text-center">
          <Link
            href="/"
            className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1"
          >
            <span>&larr; Back to Contracta home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
