import { getUserOctokit } from './userOctokit';

export interface GitHubRepoSummary {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description?: string | null;
  updatedAt?: string | null;
}

/**
 * Fetches the list of repositories accessible to the authenticated GitHub user.
 * Uses the user's OAuth access token with 'repo' scope.
 *
 * @param accessToken User's GitHub OAuth access token
 * @returns Promise<GitHubRepoSummary[]> Array of simplified repository metadata
 */
export async function listUserRepos(accessToken: string): Promise<GitHubRepoSummary[]> {
  const octokit = getUserOctokit(accessToken);

  const response = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
    visibility: 'all',
  });

  return response.data.map((repo) => ({
    id: repo.id,
    owner: repo.owner?.login || '',
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch || 'main',
    description: repo.description,
    updatedAt: repo.updated_at,
  }));
}
