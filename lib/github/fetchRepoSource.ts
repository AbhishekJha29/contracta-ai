import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import * as tar from 'tar';
import { Octokit } from '@octokit/rest';

const MAX_ARCHIVE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB size limit guardrail

/**
 * Downloads and extracts a GitHub repository tarball into an isolated temporary directory.
 * Includes a strict size guardrail (max 50 MB) before extraction to prevent resource exhaustion.
 *
 * @param octokit Authenticated Octokit client (user-scoped or installation-scoped)
 * @param owner Repository owner / org
 * @param repo Repository name
 * @param ref Branch, tag, or commit SHA to download (defaults to 'main')
 * @returns Promise<{ tempDir: string; extractedPath: string }> Root temp directory and extracted source directory
 */
export async function fetchAndExtractRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string = 'main'
): Promise<{ tempDir: string; extractedPath: string }> {
  // Create an isolated temp directory for this specific analysis run
  const uniqueId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `contracta-${owner}-${repo}-${uniqueId}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const archivePath = path.join(tempDir, 'repo.tar.gz');

  try {
    console.log(`[Contracta Ingestion] Downloading archive for ${owner}/${repo}@${ref}...`);
    const response = await octokit.repos.downloadTarballArchive({
      owner,
      repo,
      ref,
    });

    const buffer = Buffer.from(response.data as ArrayBuffer);

    // Repo size guardrail check: abort if archive exceeds 50MB
    if (buffer.byteLength > MAX_ARCHIVE_SIZE_BYTES) {
      const sizeMB = (buffer.byteLength / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Repository archive (${sizeMB} MB) exceeds maximum allowed size of 50 MB. Aborting ingestion.`
      );
    }

    // Write downloaded ArrayBuffer to disk
    fs.writeFileSync(archivePath, buffer);

    console.log(`[Contracta Ingestion] Extracting tarball archive into ${tempDir}...`);
    await tar.x({
      file: archivePath,
      cwd: tempDir,
    });

    // Delete compressed archive file to free space
    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }

    // GitHub tarballs extract into a single top-level directory: `${owner}-${repo}-${sha}`
    const entries = fs.readdirSync(tempDir);
    const extractedFolder = entries.find((entry) => {
      const fullPath = path.join(tempDir, entry);
      return fs.statSync(fullPath).isDirectory();
    });

    const extractedPath = extractedFolder ? path.join(tempDir, extractedFolder) : tempDir;
    console.log(`[Contracta Ingestion] Successfully extracted repository source to: ${extractedPath}`);

    return { tempDir, extractedPath };
  } catch (error: any) {
    // If download or extraction fails, remove the temp directory immediately
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore secondary cleanup errors
    }
    throw new Error(`Failed to fetch and extract repository ${owner}/${repo}@${ref}: ${error.message || error}`);
  }
}
