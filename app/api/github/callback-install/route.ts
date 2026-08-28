import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/db/client';

/**
 * GitHub App Installation Callback Route.
 *
 * Triggered after a user installs the Contracta GitHub App on their GitHub account
 * or organization and selects accessible repositories.
 *
 * NOTE: Full repository selection, sync, and baseline ingestion will be expanded in Phase 8.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');

  console.log(`[GitHub App Install] Received installation callback: ID=${installationId}, action=${setupAction}`);

  if (!installationId) {
    return NextResponse.redirect(new URL('/?error=missing_installation_id', request.url));
  }

  // Retrieve current session user
  const session = await auth();

  if (session?.user) {
    try {
      // Find the database User matching the session
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            ...(session.user.id ? [{ githubId: session.user.id }] : []),
            ...(session.user.email ? [{ email: session.user.email }] : []),
          ],
        },
      });

      if (user) {
        // Upsert the GitHub App Installation record
        await prisma.installation.upsert({
          where: { githubInstallationId: installationId },
          update: {
            userId: user.id,
          },
          create: {
            githubInstallationId: installationId,
            userId: user.id,
          },
        });
        console.log(`[GitHub App Install] Successfully linked installation ${installationId} to user ${user.githubUsername}`);
      } else {
        console.warn(`[GitHub App Install] User not found in database for user ID: ${session.user.id || session.user.email}`);
      }
    } catch (err: any) {
      console.error(`[GitHub App Install] Database error while linking installation:`, err.message || err);
    }
  } else {
    console.log(`[GitHub App Install] No active session during installation callback. Installation ID: ${installationId}`);
  }

  // Redirect user to workspace / dashboard
  return NextResponse.redirect(new URL('/contract/demo?installed=true', request.url));
}
