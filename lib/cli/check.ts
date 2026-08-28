import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Octokit } from '@octokit/rest';
import { parseRoutes } from '../parser/parseRoutes';
import { generateSpec } from '../generator/generateSpec';
import { diffSpecs } from '../diff/diffSpecs';
import { formatDiff } from '../diff/formatDiff';
import { createDriftIssue, commentOnPR } from '../github/createDriftReport';
import { OpenAPIObject } from 'openapi3-ts/oas30';

// Load environment variables from .env file (if present)
dotenv.config();

/**
 * Extracts the Pull Request number from the GitHub Actions event context if available.
 */
function extractPullRequestNumber(): number | undefined {
  // 1. Check GITHUB_EVENT_PATH payload (GitHub Actions standard)
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf-8'));
      if (eventData.pull_request?.number) {
        return eventData.pull_request.number;
      }
      if (eventData.number && process.env.GITHUB_EVENT_NAME === 'pull_request') {
        return eventData.number;
      }
    } catch {
      // Ignore JSON parse errors and fallback
    }
  }

  // 2. Check explicit PR_NUMBER env var
  if (process.env.PR_NUMBER) {
    const parsed = parseInt(process.env.PR_NUMBER, 10);
    if (!isNaN(parsed)) return parsed;
  }

  // 3. Check GITHUB_REF (e.g. refs/pull/123/merge)
  const ref = process.env.GITHUB_REF;
  if (ref) {
    const match = ref.match(/refs\/pull\/(\d+)\//);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) return parsed;
    }
  }

  return undefined;
}

/**
 * Main orchestration check runner for Contracta.
 */
async function runCheck(): Promise<void> {
  console.log('================================================================');
  console.log(' Contracta - OpenAPI Contract Drift & Compatibility Check');
  console.log('================================================================');

  // Step 1: Read committed baseline openapi.json
  const baselinePath = path.resolve(process.cwd(), 'openapi.json');
  if (!fs.existsSync(baselinePath)) {
    console.error(`\n❌ Error: Baseline specification file not found at: ${baselinePath}`);
    console.error('👉 Run "npm run contracta:baseline" to generate the initial baseline contract.\n');
    process.exit(1);
  }

  console.log(`\n1. Loading baseline specification from: ${baselinePath}`);
  let baselineSpec: OpenAPIObject;
  try {
    const rawBaseline = fs.readFileSync(baselinePath, 'utf-8');
    baselineSpec = JSON.parse(rawBaseline) as OpenAPIObject;
  } catch (err: any) {
    console.error('❌ Failed to parse baseline openapi.json:', err.message);
    process.exit(1);
  }

  // Step 2: Discover and parse routes from current codebase
  const appPath = process.env.APP_PATH
    ? path.resolve(process.cwd(), process.env.APP_PATH)
    : path.resolve(process.cwd(), 'fixtures/sample-express-app');

  if (!fs.existsSync(appPath)) {
    console.error(`❌ Error: Target application directory not found at: ${appPath}`);
    process.exit(1);
  }

  console.log(`2. Scanning codebase for current Express routes: ${appPath}`);
  const parsedRoutes = parseRoutes(appPath);
  console.log(`   Found ${parsedRoutes.length} route(s) in codebase.`);

  // Step 3: Generate fresh OpenAPI 3.0 specification
  console.log('3. Generating fresh OpenAPI 3.0 specification from code...');
  const freshSpec = generateSpec(parsedRoutes, {
    title: baselineSpec.info?.title || 'Contracta API',
    version: baselineSpec.info?.version || '1.0.0',
    description: baselineSpec.info?.description,
  });

  // Step 4: Run diffSpecs to compare baseline vs fresh spec
  console.log('4. Comparing baseline vs current specification...');
  const diffs = diffSpecs(baselineSpec, freshSpec);

  const breakingChanges = diffs.filter((d) => d.severity === 'breaking');
  const nonBreakingChanges = diffs.filter((d) => d.severity === 'non-breaking');

  console.log('\n--- DIFF SUMMARY ---');
  console.log(`Total Changes Detected : ${diffs.length}`);
  console.log(`🚨 Breaking Changes    : ${breakingChanges.length}`);
  console.log(`✨ Non-Breaking Changes: ${nonBreakingChanges.length}`);
  console.log('--------------------\n');

  // Step 5: Check results
  if (breakingChanges.length === 0) {
    if (nonBreakingChanges.length > 0) {
      console.log('✅ All detected changes are backwards-compatible (non-breaking):');
      for (const nb of nonBreakingChanges) {
        console.log(`   [${nb.method}] ${nb.path} (${nb.changeType}): ${nb.description}`);
      }
    } else {
      console.log('✅ No API contract drift detected. Baseline and code are perfectly synchronized.');
    }

    console.log('\n================================================================');
    console.log(' Contracta Check Passed!');
    console.log('================================================================');
    process.exit(0);
  }

  // Breaking changes exist!
  console.error('🚨 BREAKING API CONTRACT CHANGES DETECTED:\n');
  for (const b of breakingChanges) {
    console.error(`   ❌ [${b.method}] ${b.path} -> ${b.changeType}`);
    console.error(`      ${b.description}`);
  }
  console.error('');

  // Step 6: GitHub Integration (Issue Creation & PR Commenting)
  const token = process.env.GITHUB_TOKEN;
  let owner = process.env.GITHUB_OWNER;
  let repo = process.env.GITHUB_REPO;

  if ((!owner || !repo) && process.env.GITHUB_REPOSITORY) {
    const parts = process.env.GITHUB_REPOSITORY.split('/');
    if (parts.length === 2) {
      owner = parts[0];
      repo = parts[1];
    }
  }

  if (token && owner && repo) {
    console.log(`📡 GitHub Integration active for repository: ${owner}/${repo}`);
    const octokit = new Octokit({ auth: token });

    // 6a. Create GitHub Issue
    try {
      console.log('   Creating GitHub Issue for breaking drift report...');
      const { issueUrl } = await createDriftIssue(octokit, owner, repo, diffs);
      console.log(`   ✅ GitHub Issue Created: ${issueUrl}`);
    } catch (issueErr: any) {
      console.warn('   ⚠️ Warning: Failed to create GitHub issue:', issueErr.message);
    }

    // 6b. If in PR context, comment on PR
    const prNumber = extractPullRequestNumber();
    if (prNumber) {
      try {
        console.log(`   Posting diff comment on Pull Request #${prNumber}...`);
        await commentOnPR(octokit, owner, repo, prNumber, diffs);
        console.log(`   ✅ Comment successfully posted on PR #${prNumber}`);
      } catch (prErr: any) {
        console.warn(`   ⚠️ Warning: Failed to comment on PR #${prNumber}:`, prErr.message);
      }
    } else {
      console.log('   ℹ️ Not running within a PR context (or PR number not found); skipped PR comment.');
    }
  } else {
    console.log('💡 [Contracta Notice] GITHUB_TOKEN or repository info not configured.');
    console.log('   Skipping remote GitHub issue creation and PR commenting.');
    console.log('   (To enable locally, set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in .env)');
  }

  console.error('\n================================================================');
  console.error(' ❌ Contracta Check Failed: Breaking changes violate API contract.');
  console.error('================================================================\n');

  process.exit(1);
}

runCheck().catch((err) => {
  console.error('Fatal execution error in Contracta check:', err);
  process.exit(1);
});
