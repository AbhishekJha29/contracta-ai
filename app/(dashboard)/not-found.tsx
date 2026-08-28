import React from 'react';
import Link from 'next/link';
import { FolderGit2, Home, Sparkles } from 'lucide-react';

export default function DashboardNotFound() {
  return (
    <div className="flex-1 min-h-[70vh] flex items-center justify-center p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-md w-full p-8 rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-2xl text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto text-zinc-400">
          <FolderGit2 className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight text-white">
            Repository Not Found
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The requested repository could not be found or you do not have permission to view its contracts.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Workspace</span>
          </Link>

          <Link
            href="/contract/demo"
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>View Demo</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
