import pLimit from 'p-limit';
import type { ProcessingContext } from '../types/processing.js';
import { ProcessingStatus } from '../types/media.js';
import { ExifWriter } from '../services/exif-writer.js';
import logger from '../utils/logger.js';

export async function writeExifData(context: ProcessingContext): Promise<void> {
  const exifWriter = new ExifWriter();
  const limit = pLimit(3); // Lower concurrency for EXIF operations

  // Only process successfully organized files
  const filesToProcess = Array.from(context.files.values()).filter(
    (file) => file.status === ProcessingStatus.COMPLETED
  );

  const totalFiles = filesToProcess.length;
  logger.info(`Starting EXIF writing for ${totalFiles} files`);

  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;

  try {
    const tasks = filesToProcess.map((file) =>
      limit(async () => {
        const result = await exifWriter.writeExif(file, context.config);

        processedCount++;
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
          if (!file.error) {
            file.error = `EXIF write failed: ${result.error ?? 'unknown error'}`;
          }
          context.stats.exifFailures++;
        }

        if (processedCount % 100 === 0) {
          const percentage = Math.round((processedCount / totalFiles) * 100);
          logger.info(
            `EXIF writing progress: ${processedCount}/${totalFiles} (${percentage}%) | Success: ${successCount} | Failed: ${failureCount}`
          );
        }
      })
    );

    await Promise.all(tasks);

    logger.info(`EXIF writing complete: ${successCount} succeeded, ${failureCount} failed`);
  } finally {
    await exifWriter.close();
  }
}
