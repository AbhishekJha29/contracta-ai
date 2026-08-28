import { Octokit } from '@octokit/rest';

/**
 * Automatically registers a GitHub repository webhook for push events pointing to Contracta.
 *
 * @param octokit Authenticated Octokit client with 'repo' scope
 * @param owner Repository owner or organization
 * @param repo Repository name
 * @returns Promise<number | undefined> Registered GitHub webhook ID or undefined
 */
export async function registerWebhookForRepo(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<number | undefined> {
  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appBaseUrl) {
    console.warn(
      `⚠️ [Webhook Register] APP_BASE_URL is not configured. Skipping webhook registration for ${owner}/${repo}.`
    );
    return undefined;
  }

  if (!webhookSecret) {
    console.warn(
      `⚠️ [Webhook Register] GITHUB_WEBHOOK_SECRET is not configured. Skipping webhook registration for ${owner}/${repo}.`
    );
    return undefined;
  }

  const webhookUrl = `${appBaseUrl.replace(/\/+$/, '')}/api/webhooks/github`;

  try {
    console.log(`[Webhook Register] Checking existing webhooks for ${owner}/${repo}...`);

    // 1. Inspect existing webhooks to avoid duplicates
    const { data: existingHooks } = await octokit.repos.listWebhooks({
      owner,
      repo,
      per_page: 50,
    });

    const existingHook = existingHooks.find((hook) => hook.config?.url === webhookUrl);
    if (existingHook) {
      console.log(
        `✅ [Webhook Register] Webhook already exists for ${owner}/${repo} (ID: ${existingHook.id}, URL: ${webhookUrl}).`
      );
      return existingHook.id;
    }

    // 2. Create push webhook on the repository
    console.log(`[Webhook Register] Creating push webhook for ${owner}/${repo} pointing to ${webhookUrl}...`);
    const response = await octokit.repos.createWebhook({
      owner,
      repo,
      name: 'web',
      active: true,
      events: ['push'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: webhookSecret,
        insecure_ssl: '0',
      },
    });

    const webhookId = response.data.id;
    console.log(`✅ [Webhook Register] Successfully created webhook #${webhookId} on ${owner}/${repo}.`);
    return webhookId;
  } catch (error: any) {
    // Gracefully handle permission errors (e.g. user does not have admin permissions on the repo)
    console.warn(
      `⚠️ [Webhook Register] Failed to create webhook on ${owner}/${repo}: ${error.message || error}`
    );
    return undefined;
  }
}
