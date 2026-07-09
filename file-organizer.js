import { Command } from 'commander';
import { handleScanCommand } from './lib/scanner.js';
import { handleDuplicatesCommand } from './lib/duplicates.js';
import { handleOrganizeCommand } from './lib/organizer.js';
import { cleanupFiles } from './lib/cleanup.js';

const program = new Command();

program
  .name('file-organizer')
  .description('CLI tool to organize files')
  .version('1.0.0');

program
  .command('scan <directory>')
  .description('Scan directory recursively and show detailed statistics')
  .action(handleScanCommand);

program
  .command('duplicates <directory>')
  .description('Find duplicate files with identical content using SHA-256 hashes')
  .action(handleDuplicatesCommand);

program
  .command('organize <directory>')
  .requiredOption('-o, --output <directory>', 'target output directory to sort files into')
  .description('Copy and sort files into categorical directories')
  .action(handleOrganizeCommand);

program
  .command('cleanup <directory>')
  .description('Find and delete files older than a specified number of days')
  .requiredOption('-d, --days <number>', 'number of days to keep files')
  .option('--dry-run', 'preview files to be deleted without removing them')
  .action((directory, options) => {
    cleanupFiles(directory, options);
  });

program.parse();