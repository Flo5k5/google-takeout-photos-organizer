import fs from 'fs-extra';
import { statfs } from 'fs/promises';
import crypto from 'crypto';

export const MAX_UNIQUE_FILENAME_ATTEMPTS = 10000;

export function generateFileId(filePath: string): string {
  return crypto.createHash('md5').update(filePath).digest('hex');
}

export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

export async function createHardLinkOrCopy(
  source: string,
  target: string,
  fallbackToCopy: boolean = true
): Promise<
  | { success: true; method: 'hardlink' | 'copy' }
  | { success: false; method: 'failed'; errorCode?: string; errorMessage?: string }
> {
  try {
    await fs.link(source, target);
    return { success: true, method: 'hardlink' };
  } catch (error: unknown) {
    const linkError = error as NodeJS.ErrnoException;
    if (fallbackToCopy) {
      try {
        await fs.copy(source, target, {
          preserveTimestamps: true,
          overwrite: false,
          errorOnExist: true,
        });
        return { success: true, method: 'copy' };
      } catch (copyError: unknown) {
        const copyErr = copyError as NodeJS.ErrnoException;
        return {
          success: false,
          method: 'failed',
          errorCode: copyErr?.code,
          errorMessage: copyErr?.message,
        };
      }
    }
    return {
      success: false,
      method: 'failed',
      errorCode: linkError?.code,
      errorMessage: linkError?.message,
    };
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export async function getAvailableDiskSpace(dirPath: string): Promise<number | null> {
  try {
    const stats = await statfs(dirPath);
    return stats.bfree * stats.bsize;
  } catch {
    return null;
  }
}
