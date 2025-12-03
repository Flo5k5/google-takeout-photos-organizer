import { ExifTool } from 'exiftool-vendored';
import path from 'path';
import type { MediaFile } from '../types/media.js';
import type { Config } from '../types/processing.js';
import { extractPhotoTakenTimestamp, extractGeoData } from './metadata-parser.js';
import { PHOTO_EXTENSIONS } from '../constants.js';
import logger from '../utils/logger.js';

export class ExifWriter {
  private exiftool: ExifTool;

  constructor() {
    this.exiftool = new ExifTool({ taskTimeoutMillis: 10000 });
  }

  async writeExif(file: MediaFile, config: Config): Promise<{ success: boolean; error?: string }> {
    // Only write EXIF to photo files (not videos)
    const isPhoto = PHOTO_EXTENSIONS.includes(file.extension.toLowerCase());
    if (!isPhoto) {
      logger.debug('Skipping EXIF for video file', { file: file.filename });
      return { success: true }; // Not an error, just skip
    }

    if (!file.metadata || !file.processedPaths.byYear) {
      logger.debug('No metadata or processed path for file', { file: file.filename });
      return { success: true }; // Skip if no metadata
    }

    const targetPath = file.processedPaths.byYear;
    const tags: Record<string, string | number | string[]> = {};

    try {
      // Write DateTimeOriginal from photoTakenTime
      if (config.exif.writeDateTimeOriginal) {
        const timestamp = extractPhotoTakenTimestamp(file.metadata);
        if (timestamp) {
          const date = new Date(timestamp * 1000);
          // ExifTool expects format: "YYYY:MM:DD HH:MM:SS" (colons in date, not dashes)
          const exifDate = date
            .toISOString()
            .replace('T', ' ')
            .replace(/\.\d{3}Z$/, '')
            .replace(/-/g, ':');

          tags.DateTimeOriginal = exifDate;
          tags.CreateDate = exifDate;
        }
      }

      // Write GPS coordinates
      if (config.exif.writeGPS) {
        const geoData = extractGeoData(file.metadata);
        if (geoData) {
          tags.GPSLatitude = geoData.latitude;
          tags.GPSLongitude = geoData.longitude;
          if (geoData.altitude !== 0) {
            tags.GPSAltitude = geoData.altitude;
          }
          // Set GPS reference directions
          tags.GPSLatitudeRef = geoData.latitude >= 0 ? 'N' : 'S';
          tags.GPSLongitudeRef = geoData.longitude >= 0 ? 'E' : 'W';
        }
      }

      // Write description and title
      if (config.exif.writeDescription) {
        if (file.metadata.description) {
          tags.ImageDescription = file.metadata.description;
          tags.Description = file.metadata.description;
        }
        if (file.metadata.title && file.metadata.title !== file.filename) {
          tags.Title = file.metadata.title;
        }
      }

      // Write album name as keywords
      if (config.exif.writeKeywords && file.processedPaths.byAlbum) {
        const albumName = path.basename(path.dirname(file.processedPaths.byAlbum));
        tags.Keywords = albumName;
        tags.Subject = albumName;
      }

      // Write tags if we have any
      if (Object.keys(tags).length > 0) {
        const exifArgs = config.exif.preserveOriginalFile ? [] : ['-overwrite_original'];
        await this.exiftool.write(targetPath, tags, exifArgs);
        logger.debug('Wrote EXIF data', {
          file: file.filename,
          tags: Object.keys(tags),
        });
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to write EXIF', {
        file: file.filename,
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  async close(): Promise<void> {
    await this.exiftool.end();
  }
}
