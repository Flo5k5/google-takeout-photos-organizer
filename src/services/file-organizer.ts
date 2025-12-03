import fs from 'fs-extra';
import path from 'path';
import type { MediaFile } from '../types/media.js';
import type { ProcessingContext } from '../types/processing.js';
import { extractYear } from './date-extractor.js';
import { isAlbumFolder } from '../utils/path-utils.js';
import { createHardLinkOrCopy, MAX_UNIQUE_FILENAME_ATTEMPTS } from '../utils/file-utils.js';
import logger from '../utils/logger.js';
import { ProcessingStatus as Status } from '../types/media.js';

export async function organizeFile(file: MediaFile, context: ProcessingContext): Promise<void> {
  try {
    // Determine year for this file
    const year = await extractYear(file);
    const yearFolder = year === -1 ? context.config.output.unknownYearFolder : year.toString();

    // Create by-year structure
    const yearDir = path.join(context.byYearDir, yearFolder);
    await fs.ensureDir(yearDir);

    const yearResult = await copyToUniquePath(file.originalPath, yearDir, file.filename);
    file.processedPaths.byYear = yearResult.target;

    logger.debug('Organized file by year', {
      file: file.filename,
      year: yearFolder,
      target: yearResult.target,
    });

    // Create by-album structure if applicable
    if (isAlbumFolder(file.sourceFolder)) {
      const albumDir = path.join(context.byAlbumDir, file.sourceFolder);
      await fs.ensureDir(albumDir);

      const albumResult = await copyToUniquePath(yearResult.target, albumDir, file.filename, {
        useHardLinks: context.config.processing.useHardLinks,
        fallbackToCopy: context.config.processing.fallbackToCopy,
      });
      file.processedPaths.byAlbum = albumResult.target;
      logger.debug('Organized file by album', {
        file: file.filename,
        album: file.sourceFolder,
        target: albumResult.target,
        method: albumResult.method,
      });
    }

    file.status = Status.COMPLETED;
    context.stats.processedFiles++;
  } catch (error) {
    file.status = Status.FAILED;
    file.error = error instanceof Error ? error.message : String(error);
    context.stats.failedFiles++;
    logger.error('Failed to organize file', {
      file: file.filename,
      error: file.error,
    });
  }
}

async function copyToUniquePath(
  source: string,
  targetDir: string,
  filename: string,
  options: { useHardLinks?: boolean; fallbackToCopy?: boolean } = {}
): Promise<{ target: string; method: 'hardlink' | 'copy' }> {
  const { useHardLinks = false, fallbackToCopy = true } = options;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  for (let attempt = 0; attempt < MAX_UNIQUE_FILENAME_ATTEMPTS; attempt++) {
    const suffix = attempt === 0 ? '' : `_${attempt + 1}`;
    const target = path.join(targetDir, `${base}${suffix}${ext}`);

    try {
      if (useHardLinks) {
        const result = await createHardLinkOrCopy(source, target, fallbackToCopy);
        if (result.success) {
          return { target, method: result.method };
        }
        // Check both code and message for robustness against race conditions
        if (result.errorCode === 'EEXIST' || result.errorMessage?.includes('already exists')) {
          continue;
        }
        throw new Error(result.errorMessage || 'Failed to create hard link or copy');
      } else {
        // Skip if source and target are the same file
        const resolvedSource = path.resolve(source);
        const resolvedTarget = path.resolve(target);
        if (resolvedSource === resolvedTarget) {
          return { target, method: 'copy' };
        }

        await fs.copy(source, target, {
          preserveTimestamps: true,
          overwrite: false,
          errorOnExist: true,
        });
        return { target, method: 'copy' };
      }
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      // Handle case where source and destination resolve to the same file
      if (err?.message?.includes('Source and destination must not be the same')) {
        return { target, method: useHardLinks ? 'hardlink' : 'copy' };
      }
      // Check both code and message for robustness against race conditions
      if (err?.code === 'EEXIST' || err?.message?.includes('already exists')) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `Could not generate unique filename for ${filename} after ${MAX_UNIQUE_FILENAME_ATTEMPTS} attempts`
  );
}
