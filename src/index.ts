#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';
import type { Config, ProcessingContext, ProcessingStats } from './types/processing.js';
import { ProgressTracker } from './utils/progress.js';
import { validateEnvironment } from './utils/validation.js';
import logger, { configureLogger } from './utils/logger.js';
import { extractZipFiles } from './phases/1-extraction.js';
import { discoverMediaFiles } from './phases/2-discovery.js';
import { analyzeFiles } from './phases/3-analysis.js';
import { organizeFiles } from './phases/4-organization.js';
import { writeExifData } from './phases/5-exif.js';
import { setFileTimestamps } from './phases/6-timestamps.js';
import { offerCleanup } from './utils/cleanup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI setup
program
  .name('google-takeout-photos-organizer')
  .description('Organize Google Takeout photos by year and album with EXIF metadata')
  .version('1.0.0')
  .option('-i, --input <dir>', 'Directory containing Google Takeout ZIP files')
  .option('-o, --output <dir>', 'Output directory for organized photos')
  .parse();

const cliOptions = program.opts<{ input?: string; output?: string }>();

// Default configuration (embedded for npx compatibility)
const DEFAULT_CONFIG: Config = {
  input: {
    zipDirectory: '.',
    zipPattern: 'takeout-*.zip',
  },
  output: {
    stagingDir: '.takeout-staging',
    outputDir: 'Google Photos',
    byYearSubdir: '',
    byAlbumSubdir: '',
    unknownYearFolder: 'unknown',
  },
  processing: {
    concurrency: 5,
    retryAttempts: 2,
    retryDelay: 1000,
    useHardLinks: true,
    fallbackToCopy: true,
  },
  exif: {
    writeGPS: true,
    writeDescription: true,
    writeKeywords: true,
    writeDateTimeOriginal: true,
    preserveOriginalFile: false,
  },
  logging: {
    level: 'info',
    console: true,
    file: true,
    logDir: './logs',
  },
};

async function loadConfig(): Promise<Config> {
  let config: Config = { ...DEFAULT_CONFIG };

  // Try to load config from multiple locations (in order of priority)
  const configPaths = [
    path.join(process.cwd(), 'takeout-config.json'), // User config in cwd
    path.join(process.cwd(), 'config/default.json'), // User config in config dir
    path.join(__dirname, '../config/default.json'), // Package bundled config
  ];

  for (const configPath of configPaths) {
    if (await fs.pathExists(configPath)) {
      try {
        const fileConfig = await fs.readJson(configPath);
        // Deep merge with defaults
        config = {
          ...config,
          ...fileConfig,
          input: { ...config.input, ...fileConfig.input },
          output: { ...config.output, ...fileConfig.output },
          processing: { ...config.processing, ...fileConfig.processing },
          exif: { ...config.exif, ...fileConfig.exif },
          logging: { ...config.logging, ...fileConfig.logging },
        };
        logger.debug('Loaded config from', { path: configPath });
        break;
      } catch (error) {
        logger.warn('Failed to load config file', {
          path: configPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Override with CLI arguments (resolve from current working directory)
  if (cliOptions.input) {
    config.input.zipDirectory = cliOptions.input;
  }
  if (cliOptions.output) {
    config.output.outputDir = cliOptions.output;
  }

  return config;
}

function createProcessingContext(config: Config): ProcessingContext {
  // Resolve all paths from current working directory (for npx compatibility)
  const cwd = process.cwd();
  const inputDir = path.resolve(cwd, config.input.zipDirectory);
  const stagingDir = path.resolve(cwd, config.output.stagingDir);
  const outputDir = path.resolve(cwd, config.output.outputDir);
  // byYearSubdir and byAlbumSubdir can be empty for flat structure
  const byYearDir = config.output.byYearSubdir
    ? path.join(outputDir, config.output.byYearSubdir)
    : outputDir;
  const byAlbumDir = config.output.byAlbumSubdir
    ? path.join(outputDir, config.output.byAlbumSubdir)
    : outputDir;

  const stats: ProcessingStats = {
    totalFiles: 0,
    processedFiles: 0,
    failedFiles: 0,
    totalSize: 0,
    duplicateGroups: 0,
    albumCount: 0,
    yearRange: { min: 0, max: 0 },
    exifFailures: 0,
    timestampFailures: 0,
  };

  return {
    config,
    inputDir,
    stagingDir,
    outputDir,
    byYearDir,
    byAlbumDir,
    files: new Map(),
    stats,
  };
}

async function main() {
  const progress = new ProgressTracker();

  console.log('\n' + '='.repeat(60));
  console.log('Google Takeout Photos Organizer');
  console.log('='.repeat(60) + '\n');

  try {
    // Load configuration
    const config = await loadConfig();
    await configureLogger(config.logging);
    const context = createProcessingContext(config);

    logger.info('Starting Google Takeout processing', {
      inputDir: context.inputDir,
      outputDir: context.outputDir,
    });

    // Pre-flight validation
    progress.logInfo('Validating environment...');
    await validateEnvironment(context);
    progress.logSuccess('Environment validation passed');

    // Phase 1: Extraction
    progress.startPhase('ZIP Extraction', 1, 6);
    await extractZipFiles(context);
    progress.completePhase();

    // Phase 2: Discovery & Parsing
    progress.startPhase('File Discovery & Parsing', 2, 6);
    await discoverMediaFiles(context);
    progress.completePhase();

    // Phase 3: Analysis
    progress.startPhase('Duplicate Analysis', 3, 6);
    await analyzeFiles(context);
    progress.completePhase();

    // Phase 4: Organization
    progress.startPhase('File Organization', 4, 6);
    await organizeFiles(context);
    progress.completePhase();

    // Phase 5: EXIF Writing
    progress.startPhase('EXIF Data Writing', 5, 6);
    await writeExifData(context);
    progress.completePhase();

    // Phase 6: File Timestamps
    progress.startPhase('File Timestamp Setting', 6, 6);
    await setFileTimestamps(context);
    progress.completePhase();

    // Print summary
    const errors = Array.from(context.files.values())
      .filter((f) => f.error)
      .map((f) => ({ file: f.filename, error: f.error! }));

    progress.printSummary(context.stats, errors);

    logger.info('Processing completed successfully', {
      totalFiles: context.stats.totalFiles,
      processed: context.stats.processedFiles,
      failed: context.stats.failedFiles,
    });

    console.log('Output locations:');
    console.log(`  By Year: ${context.byYearDir}`);
    console.log(`  By Album: ${context.byAlbumDir}`);
    console.log('\nLogs:');
    console.log(`  Processing log: ${path.join(config.logging.logDir, 'processing.log')}`);
    console.log(`  Error log: ${path.join(config.logging.logDir, 'errors.log')}`);
    console.log('');

    // Offer cleanup of temporary files
    const hasFailures = context.stats.failedFiles > 0;
    await offerCleanup(
      context.stagingDir,
      path.resolve(process.cwd(), config.logging.logDir),
      hasFailures
    );
  } catch (error) {
    progress.logError('Fatal error during processing');
    logger.error('Processing failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error('\nFatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
