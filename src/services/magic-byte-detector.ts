import fs from 'fs/promises';
import logger from '../utils/logger.js';

// Magic byte signatures for common image formats
const SIGNATURES: Record<string, number[][]> = {
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  gif: [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF, need to also check WEBP at offset 8
  tiff: [
    [0x49, 0x49, 0x2a, 0x00], // Little-endian (II)
    [0x4d, 0x4d, 0x00, 0x2a], // Big-endian (MM)
  ],
  bmp: [[0x42, 0x4d]], // BM
};

// HEIC/HEIF uses ftyp box - need special handling
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];

/**
 * Read the first N bytes of a file
 */
async function readMagicBytes(filePath: string, length: number = 16): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

/**
 * Check if buffer matches a signature at given offset
 */
function matchesSignature(buffer: Buffer, signature: number[], offset: number = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Detect the actual file type based on magic bytes
 */
async function detectFileType(filePath: string): Promise<string | null> {
  try {
    const buffer = await readMagicBytes(filePath, 24);

    // Check JPEG
    if (matchesSignature(buffer, SIGNATURES.jpeg[0])) {
      return 'jpeg';
    }

    // Check PNG
    if (matchesSignature(buffer, SIGNATURES.png[0])) {
      return 'png';
    }

    // Check GIF
    for (const sig of SIGNATURES.gif) {
      if (matchesSignature(buffer, sig)) {
        return 'gif';
      }
    }

    // Check WEBP (RIFF at 0 + WEBP at 8)
    if (
      matchesSignature(buffer, SIGNATURES.webp[0]) &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'webp';
    }

    // Check BMP
    if (matchesSignature(buffer, SIGNATURES.bmp[0])) {
      return 'bmp';
    }

    // Check HEIC/HEIF (ftyp box)
    // Structure: [4 bytes size][4 bytes 'ftyp'][4 bytes brand]
    if (buffer.toString('ascii', 4, 8) === 'ftyp') {
      const brand = buffer.toString('ascii', 8, 12).toLowerCase();
      if (HEIC_BRANDS.includes(brand)) {
        return 'heic';
      }
    }

    // Check TIFF (also used by DNG, CR2, NEF, ARW)
    for (const sig of SIGNATURES.tiff) {
      if (matchesSignature(buffer, sig)) {
        return 'tiff';
      }
    }

    return null;
  } catch (error) {
    logger.debug('Failed to read magic bytes', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get the correct extension for a file based on its magic bytes
 * Returns the corrected extension and whether it was changed
 */
export async function getCorrectExtension(
  filePath: string,
  declaredExtension: string
): Promise<{ extension: string; corrected: boolean }> {
  const detectedType = await detectFileType(filePath);

  if (!detectedType) {
    // Could not detect, keep original
    return { extension: declaredExtension, corrected: false };
  }

  const declaredLower = declaredExtension.toLowerCase();

  // Map detected type to expected extensions
  const typeToExtensions: Record<string, string[]> = {
    jpeg: ['.jpg', '.jpeg'],
    png: ['.png'],
    gif: ['.gif'],
    webp: ['.webp'],
    bmp: ['.bmp'],
    heic: ['.heic', '.heif'],
    tiff: ['.tiff', '.tif', '.dng', '.cr2', '.nef', '.arw', '.raw'], // RAW formats use TIFF structure
  };

  const validExtensions = typeToExtensions[detectedType] || [];

  // If declared extension matches the detected type, no correction needed
  if (validExtensions.includes(declaredLower)) {
    return { extension: declaredExtension, corrected: false };
  }

  // Special case: TIFF-based formats
  // If detected as TIFF and declared as a RAW format, keep the RAW extension
  // (DNG, CR2, NEF, ARW are all TIFF-based)
  if (detectedType === 'tiff') {
    const rawExtensions = ['.dng', '.cr2', '.nef', '.arw', '.raw'];
    if (rawExtensions.includes(declaredLower)) {
      return { extension: declaredExtension, corrected: false };
    }
  }

  // Need to correct the extension
  const correctExtension = validExtensions[0]; // Use the primary extension

  // Preserve case: if original was uppercase, make correction uppercase
  const isUpperCase = declaredExtension === declaredExtension.toUpperCase();
  const finalExtension = isUpperCase ? correctExtension.toUpperCase() : correctExtension;

  logger.info('Extension mismatch detected', {
    file: filePath.split('/').pop(),
    declared: declaredExtension,
    detected: detectedType,
    correctedTo: finalExtension,
  });

  return { extension: finalExtension, corrected: true };
}
