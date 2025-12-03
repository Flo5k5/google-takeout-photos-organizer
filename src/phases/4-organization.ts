import pLimit from 'p-limit';
import type { ProcessingContext } from '../types/processing.js';
import { organizeFile } from '../services/file-organizer.js';
import logger from '../utils/logger.js';

export async function organizeFiles(context: ProcessingContext): Promise<void> {
  const limit = pLimit(context.config.processing.concurrency);
  const totalFiles = context.files.size;

  logger.info(
    `Starting organization of ${totalFiles} files with concurrency: ${context.config.processing.concurrency}`
  );

  let processedCount = 0;

  const tasks = Array.from(context.files.values()).map((file) =>
    limit(async () => {
      await organizeFile(file, context);
      processedCount++;

      if (processedCount % 100 === 0) {
        const percentage = Math.round((processedCount / totalFiles) * 100);
        logger.info(`Organized ${processedCount}/${totalFiles} files (${percentage}%)`);
      }
    })
  );

  await Promise.all(tasks);

  logger.info(
    `Organization complete: ${context.stats.processedFiles} succeeded, ${context.stats.failedFiles} failed`
  );
}
