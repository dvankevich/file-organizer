import { Command } from 'commander';
import { handleScanCommand } from './lib/scanner.js';
import { handleDuplicatesCommand } from './lib/duplicates.js';
import { handleOrganizeCommand } from './lib/organizer.js';
import { handleCleanupCommand } from './lib/cleanup.js';

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
  .requiredOption('--older-than <number>', 'minimum age limit threshold of files in days to target')
  .option('--confirm', 'grant automated execution write permission to permanently purge items')
  .description('Find and safely clear outdated files based on modification parameters')
  .action(handleCleanupCommand);

program.parse();