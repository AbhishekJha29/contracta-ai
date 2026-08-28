'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ArrowLeft, Home, Sparkles } from 'lucide-react';

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary Caught]:', error);
  }, [error]);

  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-md w-full p-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl text-center space-y-5">
        {/* Error icon badge */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight text-white">
            Unable to Load Repository View
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {error.message ||
              'An unexpected error occurred while loading repository contracts or drift reports.'}
          </p>
        </div>

        {error.digest && (
          <div className="p-2 rounded bg-zinc-950 text-[10px] font-mono text-zinc-500 border border-zinc-850">
            Error Digest: {error.digest}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-zinc-800/80">
          <Link
            href="/contract/demo"
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>Switch to Demo Workspace &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
