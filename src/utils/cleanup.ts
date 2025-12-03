import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import logger from './logger.js';
import { formatBytes } from './file-utils.js';

/**
 * Calculate total size of a directory in bytes
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  if (!(await fs.pathExists(dirPath))) return 0;

  let totalSize = 0;
  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      totalSize += await getDirectorySize(itemPath);
    } else {
      const stats = await fs.stat(itemPath);
      totalSize += stats.size;
    }
  }

  return totalSize;
}

/**
 * Check if running in interactive mode (TTY)
 */
function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Prompt user for yes/no cleanup confirmation
 */
async function promptCleanup(totalSize: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\nClean up staging and logs (${formatBytes(totalSize)})? [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/**
 * Offer cleanup of staging directory and logs after successful processing
 */
export async function offerCleanup(
  stagingDir: string,
  logDir: string,
  hasFailures: boolean
): Promise<void> {
  // Skip in non-interactive mode
  if (!isInteractive()) {
    logger.debug('Skipping cleanup prompt (non-interactive mode)');
    return;
  }

  // Check what exists
  const stagingExists = await fs.pathExists(stagingDir);
  const logDirExists = await fs.pathExists(logDir);

  if (!stagingExists && !logDirExists) {
    return;
  }

  // Calculate sizes
  const stagingSize = stagingExists ? await getDirectorySize(stagingDir) : 0;
  const logSize = logDirExists ? await getDirectorySize(logDir) : 0;

  // Warn about partial success
  if (hasFailures) {
    logger.warn('Some files failed. Staging may be useful for debugging.');
  }

  const totalSize = stagingSize + logSize;
  const shouldCleanup = await promptCleanup(totalSize);

  if (!shouldCleanup) {
    return;
  }

  // Log before removing
  logger.info('Cleaning up', { stagingDir, logDir, totalSize });

  try {
    if (stagingExists) await fs.remove(stagingDir);
    if (logDirExists) await fs.remove(logDir);
    logger.info('Cleaned up staging and logs.');
  } catch (error) {
    logger.error('Cleanup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
