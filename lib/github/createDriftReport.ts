import { Octokit } from '@octokit/rest';
import { DiffEntry } from '../diff/types';
import { formatDiff } from '../diff/formatDiff';

const LABEL_NAME = 'api-breaking-change';
const LABEL_COLOR = 'd73a4a'; // Red badge for breaking changes
const LABEL_DESCRIPTION = 'Breaking changes detected in API contract';
const ISSUE_TITLE = '🚨 API Contract Drift Detected';

/**
 * Ensures that the required GitHub label exists in the repository.
 * If the label already exists or is created concurrently, it gracefully succeeds without throwing.
 */
async function ensureLabelExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  labelName: string
): Promise<void> {
  try {
    await octokit.issues.getLabel({
      owner,
      repo,
      name: labelName,
    });
  } catch (err: any) {
    // If 404 (not found), attempt creation
    if (err.status === 404) {
      try {
        await octokit.issues.createLabel({
          owner,
          repo,
          name: labelName,
          color: LABEL_COLOR,
          description: LABEL_DESCRIPTION,
        });
      } catch (createErr: any) {
        // 422 indicates the label already exists (e.g. race condition)
        if (createErr.status !== 422) {
          console.warn(`[Contracta GitHub] Warning: Could not create label "${labelName}":`, createErr.message);
        }
      }
    } else {
      console.warn(`[Contracta GitHub] Warning: Could not verify label "${labelName}":`, err.message);
    }
  }
}

/**
 * Creates a GitHub issue reporting breaking contract drift in the repository.
 *
 * @param octokit Initialized Octokit client instance
 * @param owner Repository owner or organization
 * @param repo Repository name
 * @param diffEntries Array of DiffEntry items detected by diffSpecs
 * @returns Object containing the html URL of the created issue
 */
export async function createDriftIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  diffEntries: DiffEntry[]
): Promise<{ issueUrl: string }> {
  // Ensure the label exists before creating the issue
  await ensureLabelExists(octokit, owner, repo, LABEL_NAME);

  const issueBody = formatDiff(diffEntries);

  const response = await octokit.issues.create({
    owner,
    repo,
    title: ISSUE_TITLE,
    body: issueBody,
    labels: [LABEL_NAME],
  });

  return {
    issueUrl: response.data.html_url,
  };
}

/**
 * Posts a formatted contract diff comment directly on a Pull Request.
 *
 * @param octokit Initialized Octokit client instance
 * @param owner Repository owner or organization
 * @param repo Repository name
 * @param prNumber Pull Request number to comment on
 * @param diffEntries Array of DiffEntry items detected by diffSpecs
 */
export async function commentOnPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  diffEntries: DiffEntry[]
): Promise<void> {
  const commentBody = formatDiff(diffEntries);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: commentBody,
  });
}
