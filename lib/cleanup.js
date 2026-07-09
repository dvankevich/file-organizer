import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { formatSize, drawProgressBar, clearProgressBar } from './utils.js';

// ==========================================
// 1. CORE BUSINESS LOGIC (Pure Event Emitter)
// ==========================================
export class Cleanup extends EventEmitter {
  async execute(directory, daysThreshold, confirm = false) {
    // Notify that the cleanup analysis phase has started
    this.emit('cleanup-start', { directory, daysThreshold });

    try {
      // Step 1: Recursively retrieve all file paths
      const relativePaths = await fs.readdir(directory, { recursive: true });
      const candidates = [];
      let totalSize = 0;

      const now = Date.now();
      const msThreshold = daysThreshold * 24 * 60 * 60 * 1000;

      for (const relPath of relativePaths) {
        const fullPath = path.join(directory, relPath);
        try {
          const fileStat = await fs.stat(fullPath);
          
          if (fileStat.isFile()) {
            const fileAgeMs = now - fileStat.mtime.getTime();

            // Check if the file matches the age expiration criteria
            if (fileAgeMs > msThreshold) {
              const daysOld = Math.floor(fileAgeMs / (1000 * 60 * 60 * 24));
              
              // Format date to YYYY-MM-DD
              const yyyy = fileStat.mtime.getFullYear();
              const mm = String(fileStat.mtime.getMonth() + 1).padStart(2, '0');
              const dd = String(fileStat.mtime.getDate()).padStart(2, '0');
              const formattedDate = `${yyyy}-${mm}-${dd}`;

              const fileData = {
                path: fullPath,
                name: path.basename(fullPath),
                size: fileStat.size,
                daysOld,
                formattedDate
              };

              candidates.push(fileData);
              totalSize += fileStat.size;

              this.emit('file-found', fileData);
            }
          }
        } catch (err) {
          // Skip inaccessible or system-locked files safely
        }
      }

      // Notify UI with the list of identified deletion candidates
      this.emit('candidates-ready', { candidates, totalSize, confirm });

      // Step 2: Proceed with actual filesystem erasure if explicitly confirmed
      if (confirm && candidates.length > 0) {
        let deletedCount = 0;

        for (const file of candidates) {
          try {
            await fs.unlink(file.path);
            deletedCount++;
            this.emit('file-deleted', { current: deletedCount, total: candidates.length });
          } catch (err) {
            this.emit('delete-error', { path: file.path, error: err.message });
          }
        }
      }

      // Finalize lifecycle event emission
      this.emit('cleanup-complete', { 
        filesCount: candidates.length, 
        totalSize, 
        confirm 
      });

    } catch (error) {
      this.emit('error', error);
    }
  }
}

// ==========================================
// 2. CLI COMMAND HANDLER (UI & Orchestration)
// ==========================================
export async function handleCleanupCommand(directory, options) {
  const targetDir = path.resolve(directory);
  const daysLimit = parseInt(options.olderThan, 10);
  const isConfirmed = !!options.confirm;

  const cleanup = new Cleanup();

  // Event: Analysis setup layout log
  cleanup.on('cleanup-start', (data) => {
    console.log(`🧹 Cleanup: ${data.directory}`);
    console.log(`Looking for files older than ${daysLimit} days...\n`);
  });

  // Event: Candidates processed aggregation map delivery
  cleanup.on('candidates-ready', (data) => {
    const { candidates, totalSize, confirm } = data;

    console.log(`Found ${candidates.length} files to delete:\n`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Loop through absolutely ALL candidates without any truncation limits
    candidates.forEach((file) => {
      console.log(`${file.name}`);
      console.log(`  Size: ${formatSize(file.size)}`);
      console.log(`  Modified: ${file.daysOld} days ago (${file.formattedDate})\n`);
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total: ${candidates.length} files (${formatSize(totalSize)})\n`);

    if (!confirm) {
      // Render non-destructive instructions block
      console.log(`⚠️  DRY RUN MODE: No files were deleted.`);
      console.log(`To actually delete these files, run with --confirm flag.`);
    } else if (candidates.length > 0) {
      // Render destructive validation alert prompt notice
      console.log(`⚠️  DELETING ${candidates.length} files (${formatSize(totalSize)}). This action cannot be undone!`);
    }
  });

  // Event: Real-time progress ticking linked to utils bar
  cleanup.on('file-deleted', (data) => {
    drawProgressBar(data.current, data.total, 20, 'Deleting');
  });

  // Event: Execution success status final printing block
  cleanup.on('cleanup-complete', (data) => {
    if (data.confirm && data.filesCount > 0) {
      clearProgressBar();
      console.log(`✅ Cleanup complete!`);
      console.log(`Deleted: ${data.filesCount} files (${formatSize(data.totalSize)} freed)`);
    }
  });

  // Event: Root validation crashes or path faults
  cleanup.on('error', (error) => {
    process.stdout.write('\n');
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: Directory not found: ${targetDir}`);
    } else if (error.code === 'EACCES') {
      console.error(`❌ Error: Security lockouts or permission denied.`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
    }
    process.exit(1);
  });

  // Initialize process operation loop pipeline trigger
  await cleanup.execute(targetDir, daysLimit, isConfirmed);
}