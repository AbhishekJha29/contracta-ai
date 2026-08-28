import { Octokit } from '@octokit/rest';

/**
 * Returns an authenticated Octokit instance using the user's GitHub OAuth access token.
 * Used for listing and fetching repositories, creating drift issues, and commenting on PRs
 * on behalf of the authenticated user.
 *
 * @param accessToken The GitHub OAuth access token with 'repo' scope
 * @returns Octokit instance authenticated as the user
 */
export function getUserOctokit(accessToken: string): Octokit {
  if (!accessToken) {
    throw new Error('A valid GitHub OAuth access token is required to initialize the user Octokit client.');
  }

  return new Octokit({
    auth: accessToken,
  });
}
