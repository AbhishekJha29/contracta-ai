import NextAuth, { type DefaultSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/client';

// Extend NextAuth session and user types to include custom properties
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      email?: string | null;
      githubId?: string;
      githubUsername?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    githubId?: string | null;
    githubUsername?: string | null;
    accessToken?: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        const user = await prisma.user.findFirst({
          where: { email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.githubUsername || user.email?.split('@')[0] || 'User',
          githubId: user.githubId,
          githubUsername: user.githubUsername,
          accessToken: user.accessToken,
        };
      },
    }),
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
      if (account?.provider === 'credentials') {
        return true;
      }

      if (account?.provider === 'github' && profile) {
        const githubId = String(profile.id);
        const githubUsername = (profile.login as string) || user?.name || 'github-user';
        const email = user?.email || (profile.email as string) || null;
        const accessToken = account.access_token || null;

        try {
          // Check if an existing session is currently active (user is linking GitHub from Settings)
          const currentSession = await auth();

          if (currentSession?.user?.id) {
            const currentUserId = currentSession.user.id;

            // Check if this GitHub ID is already linked to another Contracta user account
            const existingLinkedUser = await prisma.user.findFirst({
              where: {
                githubId,
                NOT: { id: currentUserId },
              },
            });

            if (existingLinkedUser) {
              console.warn(
                `[Auth.js] GitHub linking rejected: GitHub ID ${githubId} is already linked to user ${existingLinkedUser.id}`
              );
              return '/settings?error=github_already_linked';
            }

            // Link GitHub account details to the current logged-in User row
            await prisma.user.update({
              where: { id: currentUserId },
              data: {
                githubId,
                githubUsername,
                ...(accessToken ? { accessToken } : {}),
              },
            });

            console.log(`[Auth.js] Successfully linked GitHub account @${githubUsername} to User ID ${currentUserId}`);
            return '/settings?connected=true';
          }

          // Unauthenticated GitHub Sign-In Flow:
          // Check if user with this githubId already exists
          const existingUser = await prisma.user.findFirst({
            where: { githubId },
          });

          if (existingUser) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                githubUsername,
                ...(email && !existingUser.email ? { email } : {}),
                ...(accessToken ? { accessToken } : {}),
              },
            });
            return true;
          }

          // If not found by githubId, check if an existing user with this email exists
          if (email) {
            const userWithEmail = await prisma.user.findFirst({
              where: { email },
            });

            if (userWithEmail) {
              await prisma.user.update({
                where: { id: userWithEmail.id },
                data: {
                  githubId,
                  githubUsername,
                  ...(accessToken ? { accessToken } : {}),
                },
              });
              return true;
            }
          }

          // Create a new User row
          await prisma.user.create({
            data: {
              githubId,
              githubUsername,
              email,
              accessToken,
              password: null,
            },
          });

          return true;
        } catch (error) {
          console.error('[Auth.js] Error during GitHub sign-in/linking callback:', error);
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      // On initial login, propagate User model fields to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.githubId = user.githubId;
        token.githubUsername = user.githubUsername;
        token.accessToken = user.accessToken;
      }

      // Sync fresh user record from database on token updates or refresh
      if (token.id && (trigger === 'update' || !token.email)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
          if (dbUser) {
            token.email = dbUser.email;
            token.githubId = dbUser.githubId;
            token.githubUsername = dbUser.githubUsername;
            token.accessToken = dbUser.accessToken;
          }
        } catch (dbErr) {
          console.error('[Auth.js] Failed to refresh token from DB:', dbErr);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken as string | undefined;
        if (session.user) {
          session.user.id = (token.id as string) || (token.sub as string) || '';
          session.user.email = (token.email as string) || session.user.email || '';
          session.user.githubId = token.githubId as string | undefined;
          session.user.githubUsername = token.githubUsername as string | undefined;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
