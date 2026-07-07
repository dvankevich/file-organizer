import { Command } from 'commander';

const program = new Command();

program
  .name('file-organizer')
  .description('CLI tool to organize files')
  .version('1.0.0');

// 1. SCAN
program
  .command('scan <directory>')
  .description('Scan directory recursively and show detailed statistics (count, sizes, types, age)')
  .action((directory) => {
    // виконати scan
  });

// 2. DUPLICATES
program
  .command('duplicates <directory>')
  .description('Find duplicate files with identical content using SHA-256 hashes')
  .action((directory) => {
    // виконати duplicates
  });

// 3. ORGANIZE
program
  .command('organize <directory> <targetDirectory>')
  .description('Copy and sort files into categories (Documents, Images, Archives, Code, Videos, Other)')
  .action((directory, targetDirectory) => {
    // виконати organize
  });

// 4. CLEANUP
program
  .command('cleanup <directory>')
  .description('Find and delete files older than a specified number of days')
  .requiredOption('-d, --days <number>', 'number of days to keep files')
  .option('--dry-run', 'preview files to be deleted without actually removing them')
  .action((directory, options) => {
    // виконати cleanup (використовуйте options.days та options.dryRun)
  });

program.parse();