import fs from 'fs-extra';
import { glob } from 'glob';
import readline from 'readline';
import type { ProcessingContext } from '../types/processing.js';
import { formatBytes, getAvailableDiskSpace } from './file-utils.js';
import logger from './logger.js';

/**
 * Prompt user to continue when disk space is insufficient
 */
async function promptContinue(estimatedRequired: number, availableSpace: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `\nInsufficient disk space! Required: ~${formatBytes(estimatedRequired)}, Available: ${formatBytes(availableSpace)}\nContinue anyway? [y/N] `,
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      }
    );
  });
}

export async function validateEnvironment(context: ProcessingContext): Promise<void> {
  const errors: string[] = [];

  // Check ZIP files exist and calculate total size
  const zipPattern = context.config.input.zipPattern;
  const zipDirectory = context.config.input.zipDirectory;
  const zipFiles = await glob(zipPattern, { cwd: zipDirectory, absolute: true });

  if (zipFiles.length === 0) {
    errors.push(`No ZIP files found matching pattern: ${zipPattern} in ${zipDirectory}`);
  } else {
    // Calculate total ZIP size and estimate required disk space
    let totalZipSize = 0;
    for (const zipFile of zipFiles) {
      try {
        const stats = await fs.stat(zipFile);
        totalZipSize += stats.size;
      } catch {
        // Skip files we can't stat
      }
    }

    // Estimate: ZIPs expand ~2x when extracted, plus organized copy = ~3x total
    // With hard links, album copies don't add space, so estimate ~2x
    const estimatedRequired = totalZipSize * 2;
    logger.info(`Found ${zipFiles.length} ZIP files (${formatBytes(totalZipSize)} total)`);
    logger.info(
      `Estimated disk space required: ${formatBytes(estimatedRequired)} (staging + output)`
    );

    // Check available disk space
    const availableSpace = await getAvailableDiskSpace(context.outputDir);
    if (availableSpace !== null && availableSpace < estimatedRequired) {
      if (process.stdin.isTTY) {
        const shouldContinue = await promptContinue(estimatedRequired, availableSpace);
        if (!shouldContinue) {
          errors.push('Aborted due to insufficient disk space');
        }
      } else {
        logger.warn(
          `Insufficient disk space! Required: ~${formatBytes(estimatedRequired)}, Available: ${formatBytes(availableSpace)}`
        );
      }
    }
  }

  // Check write permissions
  try {
    await fs.ensureDir(context.stagingDir);
    await fs.access(context.stagingDir, fs.constants.W_OK);
  } catch {
    errors.push(`Cannot write to staging directory: ${context.stagingDir}`);
  }

  try {
    await fs.ensureDir(context.outputDir);
    await fs.access(context.outputDir, fs.constants.W_OK);
  } catch {
    errors.push(`Cannot write to output directory: ${context.outputDir}`);
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}
