import path from 'path';
import { DUPLICATE_PATTERN } from '../constants.js';

export function parseDuplicateFilename(filename: string): {
  baseFilename: string;
  duplicateIndex: number;
} {
  const match = filename.match(DUPLICATE_PATTERN);

  if (match) {
    const [, name, index, ext] = match;
    return {
      baseFilename: `${name}${ext}`,
      duplicateIndex: parseInt(index, 10),
    };
  }

  return { baseFilename: filename, duplicateIndex: 0 };
}

function getRelativePath(basePath: string, fullPath: string): string {
  return path.relative(basePath, fullPath);
}

export function getSourceFolder(filePath: string, googlePhotosDir: string): string {
  const relativePath = getRelativePath(googlePhotosDir, filePath);
  const parts = relativePath.split(path.sep);

  // If only one part, the file is directly in Google Photos root (not in a folder)
  // Return empty string to indicate "no album"
  if (parts.length <= 1) {
    return '';
  }

  const sourceFolder = parts[0];

  // Security: Validate sourceFolder doesn't contain path traversal sequences
  if (sourceFolder.includes('..') || path.isAbsolute(sourceFolder)) {
    throw new Error(`Invalid source folder name: ${sourceFolder}`);
  }

  return sourceFolder;
}

export function isAlbumFolder(folderName: string): boolean {
  // Empty folder name means file is in root (no album)
  // "Photos from YYYY" folders are year-based collections, not albums
  return folderName !== '' && !folderName.startsWith('Photos from ');
}
