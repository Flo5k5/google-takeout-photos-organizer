import fs from 'fs-extra';
import path from 'path';
import logger from '../utils/logger.js';

const METADATA_SUFFIXES = ['.json', '.supplemental-metadata.json', '.supplemental-me.json'];

export async function findMetadataFile(mediaPath: string): Promise<string | null> {
  // Try different metadata filename patterns
  const candidates = [
    `${mediaPath}.json`,
    `${mediaPath}.supplemental-metadata.json`,
    `${mediaPath}.supplemental-me.json`,
    path.join(
      path.dirname(mediaPath),
      path.basename(mediaPath, path.extname(mediaPath)) + '.supplemental-metadata.json'
    ),
  ];

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      logger.debug('Found metadata file', { media: mediaPath, metadata: candidate });
      return candidate;
    }
  }

  logger.debug('No metadata file found', { media: mediaPath });
  return null;
}

export function isMetadataFile(filename: string): boolean {
  return METADATA_SUFFIXES.some((suffix) => filename.endsWith(suffix));
}
