import fs from 'fs-extra';
import type { MediaFile } from '../types/media.js';
import { extractPhotoTakenTimestamp, extractCreationTimestamp } from './metadata-parser.js';
import { DATE_PATTERN, YEAR_FOLDER_PATTERN } from '../constants.js';
import logger from '../utils/logger.js';

export async function extractYear(file: MediaFile): Promise<number> {
  // Priority 1: photoTakenTime from metadata
  if (file.metadata) {
    const photoTimestamp = extractPhotoTakenTimestamp(file.metadata);
    if (photoTimestamp) {
      const year = new Date(photoTimestamp * 1000).getUTCFullYear();
      if (isValidYear(year)) {
        return year;
      }
    }

    // Priority 2: creationTime from metadata
    const creationTimestamp = extractCreationTimestamp(file.metadata);
    if (creationTimestamp) {
      const year = new Date(creationTimestamp * 1000).getUTCFullYear();
      if (isValidYear(year)) {
        return year;
      }
    }
  }

  // Priority 3: Parse filename for date pattern (YYYY-MM-DD or similar)
  const filenameMatch = file.filename.match(DATE_PATTERN);
  if (filenameMatch) {
    const year = parseInt(filenameMatch[1], 10);
    if (isValidYear(year)) {
      logger.debug('Extracted year from filename', { file: file.filename, year });
      return year;
    }
  }

  // Priority 4: Extract year from sourceFolder ("Photos from YYYY")
  const folderMatch = file.sourceFolder.match(YEAR_FOLDER_PATTERN);
  if (folderMatch) {
    const year = parseInt(folderMatch[1], 10);
    if (isValidYear(year)) {
      logger.debug('Extracted year from source folder', {
        file: file.filename,
        folder: file.sourceFolder,
        year,
      });
      return year;
    }
  }

  // Priority 5: File modification time
  try {
    const stats = await fs.stat(file.originalPath);
    const year = stats.mtime.getUTCFullYear();
    if (isValidYear(year)) {
      logger.debug('Using file mtime for year', { file: file.filename, year });
      return year;
    }
  } catch (error) {
    logger.warn('Could not get file stats', {
      file: file.filename,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback: return -1 to indicate unknown year
  logger.warn('Could not determine year for file', { file: file.filename });
  return -1;
}

function isValidYear(year: number): boolean {
  // Use UTC year and add 1-year buffer to handle timezone edge cases
  const currentYear = new Date().getUTCFullYear();
  return year >= 1990 && year <= currentYear + 1;
}

export async function extractTimestamp(file: MediaFile): Promise<Date | null> {
  // Priority 1: photoTakenTime
  if (file.metadata) {
    const photoTimestamp = extractPhotoTakenTimestamp(file.metadata);
    if (photoTimestamp) {
      return new Date(photoTimestamp * 1000);
    }

    // Priority 2: creationTime
    const creationTimestamp = extractCreationTimestamp(file.metadata);
    if (creationTimestamp) {
      return new Date(creationTimestamp * 1000);
    }
  }

  // Priority 3: File modification time
  // Use processed path if available (file may have been moved from staging)
  const filePath = file.processedPaths.byYear || file.originalPath;
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}
