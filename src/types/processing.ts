import type { MediaFile } from './media.js';
export interface Config {
  input: {
    zipDirectory: string;
    zipPattern: string;
  };
  output: {
    stagingDir: string;
    outputDir: string;
    byYearSubdir: string;
    byAlbumSubdir: string;
    unknownYearFolder: string;
  };
  processing: {
    concurrency: number;
    retryAttempts: number;
    retryDelay: number;
    useHardLinks: boolean;
    fallbackToCopy: boolean;
  };
  exif: {
    writeGPS: boolean;
    writeDescription: boolean;
    writeKeywords: boolean;
    writeDateTimeOriginal: boolean;
    preserveOriginalFile: boolean;
  };
  logging: {
    level: string;
    console: boolean;
    file: boolean;
    logDir: string;
  };
}

export interface ProcessingStats {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalSize: number;
  duplicateGroups: number;
  albumCount: number;
  yearRange: { min: number; max: number };
  exifFailures: number;
  timestampFailures: number;
}

export interface ProcessingContext {
  config: Config;
  inputDir: string;
  stagingDir: string;
  outputDir: string;
  byYearDir: string;
  byAlbumDir: string;
  files: Map<string, MediaFile>;
  stats: ProcessingStats;
}
