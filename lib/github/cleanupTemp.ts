import fs from 'fs';

/**
 * Recursively deletes a temporary directory created during repository analysis.
 * Safely handles missing directories or concurrent cleanup attempts.
 *
 * @param dirPath Absolute path to the temporary directory
 */
export function cleanupTempDir(dirPath?: string): void {
  if (!dirPath) return;

  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[Contracta Cleanup] Successfully cleaned up temporary directory: ${dirPath}`);
    }
  } catch (err: any) {
    console.warn(`[Contracta Cleanup] Warning: Could not remove temporary directory ${dirPath}:`, err.message || err);
  }
}
