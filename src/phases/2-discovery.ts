import { glob } from 'glob';
import path from 'path';
import fs from 'fs-extra';
import type { ProcessingContext } from '../types/processing.js';
import type { MediaFile } from '../types/media.js';
import { MEDIA_EXTENSIONS, GOOGLE_PHOTOS_DIR } from '../constants.js';
import { ProcessingStatus } from '../types/media.js';
import { findMetadataFile, isMetadataFile } from '../services/metadata-matcher.js';
import { parseMetadataFile } from '../services/metadata-parser.js';
import { parseDuplicateFilename, getSourceFolder, isAlbumFolder } from '../utils/path-utils.js';
import { generateFileId, getFileSize } from '../utils/file-utils.js';
import { getCorrectExtension } from '../services/magic-byte-detector.js';
import logger from '../utils/logger.js';

export async function discoverMediaFiles(context: ProcessingContext): Promise<void> {
  const googlePhotosDir = path.join(context.stagingDir, GOOGLE_PHOTOS_DIR);

  if (!(await fs.pathExists(googlePhotosDir))) {
    throw new Error(`Google Photos directory not found: ${googlePhotosDir}`);
  }

  logger.info(`Scanning for media files in: ${googlePhotosDir}`);

  // Find all files (not directories)
  const allFiles = await glob('**/*', {
    cwd: googlePhotosDir,
    nodir: true,
    absolute: true,
  });

  logger.info(`Found ${allFiles.length} total files`);

  // Filter media files (case-insensitive extension matching)
  const mediaFiles = allFiles.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return MEDIA_EXTENSIONS.includes(ext) && !isMetadataFile(file);
  });

  logger.info(`Found ${mediaFiles.length} media files`);

  // Process each media file
  let processedCount = 0;
  for (const filePath of mediaFiles) {
    try {
      const mediaFile = await processMediaFile(filePath, googlePhotosDir);
      context.files.set(mediaFile.id, mediaFile);

      // Update stats
      const fileSize = await getFileSize(filePath);
      context.stats.totalSize += fileSize;

      processedCount++;
      if (processedCount % 100 === 0) {
        logger.info(`Processed ${processedCount}/${mediaFiles.length} files`);
      }
    } catch (error) {
      context.stats.failedFiles++;
      logger.error(`Failed to process media file: ${filePath}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  context.stats.totalFiles = context.files.size;
  logger.info(`Discovery complete: ${context.stats.totalFiles} media files cataloged`);

  // Count albums based on source folders
  const albumNames = new Set<string>();
  for (const file of context.files.values()) {
    if (isAlbumFolder(file.sourceFolder)) {
      albumNames.add(file.sourceFolder);
    }
  }
  context.stats.albumCount = albumNames.size;
  logger.info(`Discovered ${context.stats.albumCount} albums`);
}

async function processMediaFile(filePath: string, googlePhotosDir: string): Promise<MediaFile> {
  const originalFilename = path.basename(filePath);
  const declaredExtension = path.extname(originalFilename);
  const sourceFolder = getSourceFolder(filePath, googlePhotosDir);

  // Detect actual file type via magic bytes and correct extension if needed
  const { extension, corrected } = await getCorrectExtension(filePath, declaredExtension);
  const filename = corrected ? originalFilename.replace(/\.[^/.]+$/, extension) : originalFilename;

  // Find and parse metadata
  let metadata = null;

  const metadataPath = await findMetadataFile(filePath);
  if (metadataPath) {
    metadata = await parseMetadataFile(metadataPath);
  } else {
    logger.debug('No metadata found for file', { file: filename });
  }

  // Detect duplicate patterns
  const { baseFilename, duplicateIndex } = parseDuplicateFilename(filename);

  const mediaFile: MediaFile = {
    id: generateFileId(filePath),
    originalPath: filePath,
    filename,
    extension,
    metadata,
    sourceFolder,
    duplicateGroup: baseFilename !== filename ? baseFilename : null,
    duplicateIndex,
    processedPaths: { byYear: null, byAlbum: null },
    status: ProcessingStatus.PENDING,
    error: null,
  };

  return mediaFile;
}
