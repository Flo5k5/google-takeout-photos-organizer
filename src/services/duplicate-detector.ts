import type { MediaFile } from '../types/media.js';
import type { ProcessingContext } from '../types/processing.js';
import logger from '../utils/logger.js';

export function analyzeDuplicates(context: ProcessingContext): Map<string, MediaFile[]> {
  const duplicateGroups = new Map<string, MediaFile[]>();

  // Group files by base filename (duplicateGroup or filename)
  for (const file of context.files.values()) {
    const groupKey = file.duplicateGroup || file.filename;

    if (!duplicateGroups.has(groupKey)) {
      duplicateGroups.set(groupKey, []);
    }

    duplicateGroups.get(groupKey)!.push(file);
  }

  // Sort each group by duplicate index and update stats
  let duplicateGroupCount = 0;

  for (const [groupKey, files] of duplicateGroups) {
    if (files.length > 1) {
      // Sort by duplicate index (original first, then (1), (2), etc.)
      files.sort((a, b) => a.duplicateIndex - b.duplicateIndex);
      duplicateGroupCount++;

      logger.info('Found duplicate group', {
        baseFilename: groupKey,
        count: files.length,
        files: files.map((f) => f.filename),
      });
    }
  }

  context.stats.duplicateGroups = duplicateGroupCount;

  return duplicateGroups;
}
