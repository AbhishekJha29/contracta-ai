import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

/**
 * Parses and formats the GitHub App RSA Private Key.
 * Supports:
 * 1. Standard PEM string with escaped newlines: "-----BEGIN RSA PRIVATE KEY-----\nMIIE..."
 * 2. Base64-encoded PEM string
 * 3. Multi-line PEM string
 */
export function formatPrivateKey(rawKey?: string): string {
  const key = rawKey || process.env.GITHUB_APP_PRIVATE_KEY || '';
  if (!key) {
    throw new Error('GITHUB_APP_PRIVATE_KEY environment variable is not defined.');
  }

  // If base64 encoded (does not start with '-----BEGIN')
  if (!key.trim().startsWith('-----BEGIN') && key.length > 50) {
    try {
      return Buffer.from(key, 'base64').toString('utf-8');
    } catch {
      // Fall through if base64 decoding fails
    }
  }

  // Replace literal '\n' characters with actual newlines
  return key.replace(/\\n/g, '\n');
}

/**
 * Creates an authenticated Octokit client instance scoped to a GitHub App Installation.
 * Uses the App ID and Private Key to generate short-lived installation access tokens automatically.
 *
 * @param installationId The numeric or string GitHub App Installation ID
 * @returns Promise<Octokit> Authenticated Octokit client instance
 */
export async function getInstallationOctokit(installationId: string | number): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) {
    throw new Error('GITHUB_APP_ID environment variable is not defined.');
  }

  const privateKey = formatPrivateKey();
  const numericId = typeof installationId === 'string' ? parseInt(installationId, 10) : installationId;

  if (isNaN(numericId)) {
    throw new Error(`Invalid GitHub App Installation ID provided: ${installationId}`);
  }

  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId: numericId,
    },
  });

  return octokit;
}
