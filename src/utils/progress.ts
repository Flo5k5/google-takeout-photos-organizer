import chalk from 'chalk';
import type { ProcessingStats } from '../types/processing.js';
import { formatBytes } from './file-utils.js';

export class ProgressTracker {
  startPhase(phaseName: string, phaseNumber: number, totalPhases: number): void {
    console.log(`\n${chalk.bold.cyan(`Phase ${phaseNumber}/${totalPhases}: ${phaseName}`)}`);
    console.log(chalk.gray('='.repeat(60)));
  }

  completePhase(): void {
    console.log(chalk.green('\u2713 Phase completed\n'));
  }

  logInfo(message: string): void {
    console.log(chalk.blue('\u2139 ') + message);
  }

  logSuccess(message: string): void {
    console.log(chalk.green('\u2713 ') + message);
  }

  logError(message: string): void {
    console.log(chalk.red('\u2717 ') + message);
  }

  printSummary(stats: ProcessingStats, errors: Array<{ file: string; error: string }>): void {
    console.log('\n' + chalk.bold.cyan('='.repeat(60)));
    console.log(chalk.bold.cyan('PROCESSING COMPLETE'));
    console.log(chalk.bold.cyan('='.repeat(60)) + '\n');

    console.log(chalk.bold('Statistics:'));
    console.log(`  Total files processed: ${chalk.green(stats.processedFiles.toString())}`);
    console.log(
      `  Failed: ${stats.failedFiles > 0 ? chalk.red(stats.failedFiles.toString()) : chalk.green('0')}`
    );
    if (stats.exifFailures > 0) {
      console.log(`  EXIF write failures: ${chalk.yellow(stats.exifFailures.toString())}`);
    }
    if (stats.timestampFailures > 0) {
      console.log(`  Timestamp failures: ${chalk.yellow(stats.timestampFailures.toString())}`);
    }
    console.log(`  Duplicate groups: ${chalk.yellow(stats.duplicateGroups.toString())}`);
    console.log(`  Albums: ${stats.albumCount}`);
    console.log(`  Year range: ${stats.yearRange.min}-${stats.yearRange.max}`);
    console.log(`  Total size: ${formatBytes(stats.totalSize)}`);

    if (errors.length > 0) {
      console.log(`\n${chalk.bold.red('Errors:')} (showing first 10)`);
      errors.slice(0, 10).forEach(({ file, error }) => {
        console.log(`  ${chalk.red('\u2717')} ${file}`);
        console.log(`    ${chalk.gray(error)}`);
      });

      if (errors.length > 10) {
        console.log(`  ${chalk.gray(`... and ${errors.length - 10} more errors`)}`);
      }
    }

    console.log('\n' + chalk.bold.cyan('='.repeat(60)) + '\n');
  }
}
