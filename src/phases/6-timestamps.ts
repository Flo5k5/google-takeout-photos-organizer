import fs from 'fs-extra';
import pLimit from 'p-limit';
import type { ProcessingContext } from '../types/processing.js';
import type { MediaFile } from '../types/media.js';
import { ProcessingStatus } from '../types/media.js';
import { extractTimestamp } from '../services/date-extractor.js';
import logger from '../utils/logger.js';

export async function setFileTimestamps(context: ProcessingContext): Promise<void> {
  const limit = pLimit(context.config.processing.concurrency);

  // Only process successfully organized files
  const filesToProcess = Array.from(context.files.values()).filter(
    (file) => file.status === ProcessingStatus.COMPLETED
  );

  const totalFiles = filesToProcess.length;
  logger.info(`Setting timestamps for ${totalFiles} files`);

  let successCount = 0;
  let failureCount = 0;
  let processedCount = 0;

  const tasks = filesToProcess.map((file) =>
    limit(async () => {
      const result = await setFileTimestamp(file);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        if (!file.error) {
          file.error = `Timestamp update failed: ${result.error ?? 'unknown error'}`;
        }
        context.stats.timestampFailures++;
      }

      processedCount++;
      if (processedCount % 100 === 0) {
        const percentage = Math.round((processedCount / totalFiles) * 100);
        logger.info(
          `Timestamp progress: ${processedCount}/${totalFiles} (${percentage}%) | Success: ${successCount} | Failed: ${failureCount}`
        );
      }
    })
  );

  await Promise.all(tasks);

  logger.info(`Timestamps complete: ${successCount} succeeded, ${failureCount} failed`);
}

async function setFileTimestamp(file: MediaFile): Promise<{ success: boolean; error?: string }> {
  try {
    const timestamp = await extractTimestamp(file);
    if (!timestamp) {
      return { success: false, error: 'No valid timestamp found' };
    }

    // Set timestamp on primary file (by-year)
    if (file.processedPaths.byYear) {
      await fs.utimes(file.processedPaths.byYear, timestamp, timestamp);
    }

    // Hard links share inodes, so setting on one sets on all
    // But if it's a copy (not hard link), we need to set both
    if (file.processedPaths.byAlbum) {
      const areLinked = await areHardLinked(
        file.processedPaths.byYear,
        file.processedPaths.byAlbum
      );
      if (!areLinked) {
        await fs.utimes(file.processedPaths.byAlbum, timestamp, timestamp);
      }
    }

    return { success: true };
  } catch (error) {
    logger.error(`Failed to set timestamp for ${file.filename}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: String(error) };
  }
}

async function areHardLinked(path1: string | null, path2: string | null): Promise<boolean> {
  if (!path1 || !path2) {
    return false;
  }

  try {
    const stats1 = await fs.stat(path1);
    const stats2 = await fs.stat(path2);
    return stats1.ino === stats2.ino;
  } catch {
    return false;
  }
}
