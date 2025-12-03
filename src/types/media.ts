export enum ProcessingStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface GoogleMetadata {
  title: string;
  description: string;
  photoTakenTime?: {
    timestamp: string;
    formatted: string;
  };
  creationTime?: {
    timestamp: string;
    formatted: string;
  };
  geoData?: {
    latitude: number;
    longitude: number;
    altitude: number;
    latitudeSpan: number;
    longitudeSpan: number;
  };
  geoDataExif?: {
    latitude: number;
    longitude: number;
    altitude: number;
    latitudeSpan: number;
    longitudeSpan: number;
  };
}

export interface ProcessedPaths {
  byYear: string | null;
  byAlbum: string | null;
}

export interface MediaFile {
  id: string;
  originalPath: string;
  filename: string;
  extension: string;
  metadata: GoogleMetadata | null;
  sourceFolder: string;
  duplicateGroup: string | null;
  duplicateIndex: number;
  processedPaths: ProcessedPaths;
  status: ProcessingStatus;
  error: string | null;
}
