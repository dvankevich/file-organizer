import { Command } from 'commander';
import { scanDirectory } from './lib/scanner.js';
import { findDuplicates } from './lib/duplicates.js';
import { organizeFiles } from './lib/organizer.js';
import { cleanupFiles } from './lib/cleanup.js';

const program = new Command();

program
  .name('file-organizer')
  .description('CLI tool to organize files')
  .version('1.0.0');

program
  .command('scan <directory>')
  .description('Scan directory recursively and show detailed statistics')
  .action((directory) => {
    scanDirectory(directory);
  });

program
  .command('duplicates <directory>')
  .description('Find duplicate files with identical content using SHA-256 hashes')
  .action((directory) => {
    findDuplicates(directory);
  });

program
  .command('organize <directory> <targetDirectory>')
  .description('Copy and sort files into categories')
  .action((directory, targetDirectory) => {
    organizeFiles(directory, targetDirectory);
  });

program
  .command('cleanup <directory>')
  .description('Find and delete files older than a specified number of days')
  .requiredOption('-d, --days <number>', 'number of days to keep files')
  .option('--dry-run', 'preview files to be deleted without removing them')
  .action((directory, options) => {
    cleanupFiles(directory, options);
  });

program.parse();