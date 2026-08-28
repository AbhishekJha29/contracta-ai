import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { Sidebar } from '@/components/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Protect all dashboard routes (/contract/*, /drift/*, /activity/*)
  if (!session?.user) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex bg-zinc-950 text-zinc-100 antialiased">
      {/* Fixed/Sticky Left Sidebar */}
      <Sidebar repoId="demo" />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        {children}
      </div>
    </div>
  );
}
