import NextAuth, { type DefaultSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { prisma } from '@/lib/db/client';

// Extend NextAuth session types to include accessToken and githubUsername
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      githubUsername?: string;
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          // 'repo' scope grants access to public & private repositories for AST extraction & PR checks
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'github' && profile) {
        const githubId = String(profile.id);
        const githubUsername = (profile.login as string) || user.name || 'github-user';
        const email = user.email || (profile.email as string) || null;
        const accessToken = account.access_token;

        try {
          // Note: In production, access tokens should be encrypted at rest before storing in database.
          await prisma.user.upsert({
            where: { githubId },
            update: {
              githubUsername,
              email,
              ...(accessToken ? { accessToken } : {}),
            },
            create: {
              githubId,
              githubUsername,
              email,
              ...(accessToken ? { accessToken } : {}),
            },
          });
        } catch (error) {
          console.error('[Auth.js] Failed to upsert user in database:', error);
        }
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      // Persist GitHub OAuth access token into the JWT token on initial sign-in
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      if (profile?.id) {
        token.githubId = String(profile.id);
      }
      if (profile?.login) {
        token.githubUsername = profile.login as string;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose the access token to the server/client session for Octokit API calls
      if (token) {
        session.accessToken = token.accessToken as string | undefined;
        if (session.user) {
          session.user.id = (token.githubId as string) || token.sub || '';
          session.user.githubUsername = token.githubUsername as string | undefined;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
});
