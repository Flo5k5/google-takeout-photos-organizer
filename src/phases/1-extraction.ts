import extract from 'extract-zip';
import { glob } from 'glob';
import path from 'path';
import yauzl from 'yauzl';
import type { ProcessingContext } from '../types/processing.js';
import { sleep, formatBytes } from '../utils/file-utils.js';
import logger from '../utils/logger.js';

// Safety limits for ZIP extraction
const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024 * 1024; // 500 GB max total
const MAX_FILE_COUNT = 2_000_000; // 2 million files max
const MAX_COMPRESSION_RATIO = 100; // Reject if compression ratio > 100:1 (zip bomb indicator)

export async function extractZipFiles(context: ProcessingContext): Promise<void> {
  const zipFiles = await glob(context.config.input.zipPattern, {
    cwd: context.config.input.zipDirectory,
    absolute: true,
  });

  const total = zipFiles.length;

  if (total === 0) {
    throw new Error(`No ZIP files found matching pattern: ${context.config.input.zipPattern}`);
  }

  logger.info(`Found ${total} ZIP files to extract`);

  for (let i = 0; i < total; i++) {
    const zipPath = zipFiles[i];
    const zipName = path.basename(zipPath);
    const progress = Math.round(((i + 1) / total) * 100);

    logger.info(`Extracting ZIP ${i + 1}/${total}: ${zipName} (${progress}%)`);

    try {
      await extractZipWithRetry(
        zipPath,
        context.stagingDir,
        context.config.processing.retryAttempts,
        context.config.processing.retryDelay
      );
      logger.info(`Successfully extracted: ${zipName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`ZIP extraction failed: ${zipName}`, { error: errorMessage });
      throw new Error(`Failed to extract ${zipName}: ${errorMessage}`);
    }
  }

  logger.info(`All ${total} ZIP files extracted successfully`);
}

interface ZipValidationResult {
  valid: boolean;
  fileCount: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionRatio: number;
  error?: string;
}

async function validateZipFile(zipPath: string): Promise<ZipValidationResult> {
  return new Promise((resolve) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        resolve({
          valid: false,
          fileCount: 0,
          compressedSize: 0,
          uncompressedSize: 0,
          compressionRatio: 0,
          error: err?.message || 'Failed to open ZIP file',
        });
        return;
      }

      let fileCount = 0;
      let totalUncompressedSize = 0;
      let totalCompressedSize = 0;

      zipfile.on('entry', (entry) => {
        fileCount++;
        totalUncompressedSize += entry.uncompressedSize;
        totalCompressedSize += entry.compressedSize;

        // Check limits incrementally
        if (fileCount > MAX_FILE_COUNT) {
          zipfile.close();
          resolve({
            valid: false,
            fileCount,
            compressedSize: totalCompressedSize,
            uncompressedSize: totalUncompressedSize,
            compressionRatio:
              totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0,
            error: `ZIP contains too many files (>${MAX_FILE_COUNT})`,
          });
          return;
        }

        if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
          zipfile.close();
          resolve({
            valid: false,
            fileCount,
            compressedSize: totalCompressedSize,
            uncompressedSize: totalUncompressedSize,
            compressionRatio:
              totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0,
            error: `ZIP uncompressed size exceeds limit (${formatBytes(totalUncompressedSize)} > ${formatBytes(MAX_UNCOMPRESSED_SIZE)})`,
          });
          return;
        }

        zipfile.readEntry();
      });

      zipfile.on('end', () => {
        const compressionRatio =
          totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0;

        if (compressionRatio > MAX_COMPRESSION_RATIO) {
          resolve({
            valid: false,
            fileCount,
            compressedSize: totalCompressedSize,
            uncompressedSize: totalUncompressedSize,
            compressionRatio,
            error: `Suspicious compression ratio (${compressionRatio.toFixed(1)}:1) - possible zip bomb`,
          });
          return;
        }

        resolve({
          valid: true,
          fileCount,
          compressedSize: totalCompressedSize,
          uncompressedSize: totalUncompressedSize,
          compressionRatio,
        });
      });

      zipfile.on('error', (error) => {
        resolve({
          valid: false,
          fileCount,
          compressedSize: totalCompressedSize,
          uncompressedSize: totalUncompressedSize,
          compressionRatio:
            totalCompressedSize > 0 ? totalUncompressedSize / totalCompressedSize : 0,
          error: error.message,
        });
      });

      zipfile.readEntry();
    });
  });
}

async function extractZipWithRetry(
  zipPath: string,
  targetDir: string,
  retries: number,
  retryDelay: number
): Promise<void> {
  // Validate ZIP before extraction
  const validation = await validateZipFile(zipPath);
  if (!validation.valid) {
    throw new Error(`ZIP validation failed: ${validation.error}`);
  }

  logger.debug('ZIP validation passed', {
    file: path.basename(zipPath),
    files: validation.fileCount,
    uncompressedSize: formatBytes(validation.uncompressedSize),
    compressionRatio: `${validation.compressionRatio.toFixed(1)}:1`,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await extract(zipPath, { dir: path.resolve(targetDir) });
      return; // Success!
    } catch (error) {
      if (attempt === retries) {
        // Last attempt failed, throw error
        throw error;
      }

      // Wait before retrying (exponential backoff)
      const baseDelay = Math.max(retryDelay, 100);
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Extraction attempt ${attempt + 1} failed, retrying in ${delay}ms...`, {
        file: path.basename(zipPath),
      });
      await sleep(delay);
    }
  }
}
