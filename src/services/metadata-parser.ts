import fs from 'fs-extra';
import { z } from 'zod';
import type { GoogleMetadata } from '../types/media.js';
import logger from '../utils/logger.js';

// Zod schemas for runtime validation
const TimestampSchema = z
  .object({
    timestamp: z.string(),
    formatted: z.string(),
  })
  .optional();

const GeoDataSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    altitude: z.number(),
    latitudeSpan: z.number().optional(),
    longitudeSpan: z.number().optional(),
  })
  .optional();

const GoogleMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  imageViews: z.string().optional(),
  photoTakenTime: TimestampSchema,
  creationTime: TimestampSchema,
  geoData: GeoDataSchema,
  geoDataExif: GeoDataSchema,
  url: z.string().optional(),
  googlePhotosOrigin: z
    .object({
      mobileUpload: z
        .object({
          deviceType: z.string().optional(),
          deviceFolder: z
            .object({
              localFolderName: z.string().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function parseMetadataFile(filePath: string): Promise<GoogleMetadata | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Validate with zod schema
    const result = GoogleMetadataSchema.safeParse(data);
    if (!result.success) {
      logger.warn('Metadata validation failed', {
        file: filePath,
        errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
      return null;
    }

    return result.data as GoogleMetadata;
  } catch (error) {
    logger.error('Failed to parse metadata file', {
      file: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Timestamp bounds: Jan 1, 1990 to 1 year from now (Unix seconds)
const MIN_TIMESTAMP = 631152000; // 1990-01-01
const getMaxTimestamp = () => Math.floor(Date.now() / 1000) + 31536000; // Now + 1 year

function isValidTimestamp(timestamp: number): boolean {
  return timestamp >= MIN_TIMESTAMP && timestamp <= getMaxTimestamp();
}

export function extractPhotoTakenTimestamp(metadata: GoogleMetadata): number | null {
  if (metadata.photoTakenTime?.timestamp) {
    const timestamp = parseInt(metadata.photoTakenTime.timestamp, 10);
    if (!isNaN(timestamp) && isValidTimestamp(timestamp)) {
      return timestamp;
    }
  }
  return null;
}

export function extractCreationTimestamp(metadata: GoogleMetadata): number | null {
  if (metadata.creationTime?.timestamp) {
    const timestamp = parseInt(metadata.creationTime.timestamp, 10);
    if (!isNaN(timestamp) && isValidTimestamp(timestamp)) {
      return timestamp;
    }
  }
  return null;
}

function isValidGpsCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function extractGeoData(metadata: GoogleMetadata): {
  latitude: number;
  longitude: number;
  altitude: number;
} | null {
  // Try geoDataExif first, fall back to geoData if geoDataExif is missing or has zero coordinates
  let geoData = metadata.geoDataExif;
  if (!geoData || (geoData.latitude === 0 && geoData.longitude === 0)) {
    geoData = metadata.geoData;
  }

  if (geoData && (geoData.latitude !== 0 || geoData.longitude !== 0)) {
    // Validate GPS coordinates are within valid ranges
    if (!isValidGpsCoordinate(geoData.latitude, geoData.longitude)) {
      return null;
    }
    return {
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      altitude: typeof geoData.altitude === 'number' ? geoData.altitude : 0,
    };
  }

  return null;
}
