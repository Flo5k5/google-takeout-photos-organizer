import type { ProcessingContext } from '../types/processing.js';
import { analyzeDuplicates } from '../services/duplicate-detector.js';
import logger from '../utils/logger.js';

export async function analyzeFiles(context: ProcessingContext): Promise<void> {
  logger.info('Analyzing files for duplicates and computing statistics...');

  // Analyze duplicates
  analyzeDuplicates(context);

  logger.info(`Found ${context.stats.duplicateGroups} duplicate groups`);

  // Compute year range (only include valid years: 1990 to current year + 1)
  const currentYear = new Date().getUTCFullYear();
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const [, file] of context.files) {
    if (file.metadata?.photoTakenTime?.timestamp) {
      const timestamp = parseInt(file.metadata.photoTakenTime.timestamp, 10);
      if (timestamp > 0) {
        const year = new Date(timestamp * 1000).getUTCFullYear();
        // Validate year is within reasonable bounds
        if (year >= 1990 && year <= currentYear + 1) {
          if (year < minYear) minYear = year;
          if (year > maxYear) maxYear = year;
        }
      }
    }
  }

  if (minYear !== Infinity && maxYear !== -Infinity) {
    context.stats.yearRange = { min: minYear, max: maxYear };
    logger.info(`Year range: ${minYear}-${maxYear}`);
  } else {
    context.stats.yearRange = { min: 0, max: 0 };
    logger.warn('Could not determine year range');
  }

  logger.info('Analysis complete');
}
