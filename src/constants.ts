// All extensions are lowercase - use case-insensitive comparison (ext.toLowerCase())
export const MEDIA_EXTENSIONS = [
  // Photos
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.heic',
  '.heif',
  '.dng',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.raw',
  '.cr2',
  '.nef',
  '.arw',
  // Videos
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.3gp',
  '.m4v',
];

export const PHOTO_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.heic',
  '.heif',
  '.dng',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.raw',
  '.cr2',
  '.nef',
  '.arw',
];

export const YEAR_FOLDER_PATTERN = /^Photos from (\d{4})$/;
export const DUPLICATE_PATTERN = /^(.+)\((\d+)\)(\.[^.]+)$/;
// Matches date patterns: YYYYMMDD, YYYY-MM-DD, YYYY_MM_DD (at start or after non-digit)
// Captures year in group 1 for extraction
export const DATE_PATTERN = /(?:^|[^0-9])(20[0-2]\d)[-_]?([01]\d)[-_]?([0-3]\d)/;

export const GOOGLE_PHOTOS_DIR = 'Takeout/Google Photos';
