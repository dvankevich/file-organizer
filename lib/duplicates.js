import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { calculateHash, formatSize, drawProgressBar, clearProgressBar } from './utils.js';

// ==========================================
// 1. CORE BUSINESS LOGIC (Pure Event Emitter)
// ==========================================
export class DuplicateFinder extends EventEmitter {
  async find(directory) {
    // Notify UI that duplicate scan started
    this.emit('duplicates-start', { directory });

    try {
      // Step 1: Recursively acquire all files under the path
      const relativePaths = await fs.readdir(directory, { recursive: true });
      const filePaths = [];

      for (const relPath of relativePaths) {
        const fullPath = path.join(directory, relPath);
        try {
          const fileStat = await fs.stat(fullPath);
          if (fileStat.isFile()) {
            filePaths.push({ fullPath, size: fileStat.size });
          }
        } catch (err) {
          // Skip inaccessible file logs safely
          this.emit('file-error', { path: fullPath, error: err.message });
        }
      }

      const totalFiles = filePaths.length;
      const hashMap = new Map(); // Store structure: hash -> Array<{ path, size }>
      let processedCount = 0;

      // Step 2: Stream through each file to calculate its unique hash
      for (const file of filePaths) {
        try {
          const hash = await calculateHash(file.fullPath);

          if (!hashMap.has(hash)) {
            hashMap.set(hash, []);
          }
          hashMap.get(hash).push({ path: file.fullPath, size: file.size });
        } catch (err) {
          this.emit('file-error', { path: file.fullPath, error: err.message });
        } finally {
          processedCount++;
          // Emit progress step for accurate progress bar calculations
          this.emit('file-processed', { current: processedCount, total: totalFiles });
        }
      }

      // Step 3: Aggregate and sort only valid duplicate groups (copies > 1)
      const duplicateGroups = [];
      let totalWastedSpace = 0;

      for (const [hash, files] of hashMap.entries()) {
        if (files.length > 1) {
          const fileSize = files[0].size;
          const copiesCount = files.length;
          const wastedSpace = fileSize * (copiesCount - 1);
          totalWastedSpace += wastedSpace;

          duplicateGroups.push({
            hash,
            fileSize,
            copiesCount,
            wastedSpace,
            files: files.map(f => f.path)
          });
        }
      }

      // Emit final payload results back to orchestration handler
      this.emit('duplicates-found', {
        duplicateGroups,
        totalWastedSpace
      });

    } catch (error) {
      this.emit('error', error);
    }
  }
}

// ==========================================
// 2. CLI COMMAND HANDLER (UI & Orchestration)
// ==========================================
export async function handleDuplicatesCommand(directory) {
  const targetDir = path.resolve(directory);
  const finder = new DuplicateFinder();

  // Event: Command initialization print
  finder.on('duplicates-start', (data) => {
    console.log(`🔍 Searching for duplicates in: ${data.directory}`);
  });

  // Event: Progress updates bound to your ASCII bar
  finder.on('file-processed', (data) => {
    drawProgressBar(data.current, data.total, 20, 'Calculating hashes');
  });

  // Event: Process execution successfully concluded, printing report
  finder.on('duplicates-found', (data) => {
    const { duplicateGroups, totalWastedSpace } = data;
    clearProgressBar();

    console.log(`Found ${duplicateGroups.length} duplicate groups (${formatSize(totalWastedSpace)} wasted):\n`);

    duplicateGroups.forEach((group, idx) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Group ${idx + 1} (${group.copiesCount} copies, ${formatSize(group.fileSize)} each):`);
      console.log(`  SHA-256: ${group.hash}\n`);

      group.files.forEach((filePath) => {
        // Formats file path relative to scanning root parent for identical looks as requested
        const displayPath = path.relative(path.dirname(targetDir), filePath);
        console.log(`  📄 ${displayPath}`);
      });

      console.log(`\n  Wasted space: ${formatSize(group.wastedSpace)}`);
    });

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`💾 Total wasted space: ${formatSize(totalWastedSpace)}`);
  });

  // Event: Severe system interruption or invalid destination targets
  finder.on('error', (error) => {
    process.stdout.write('\n');
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: Directory not found: ${targetDir}`);
    } else if (error.code === 'EACCES') {
      console.error(`❌ Error: Permission denied: ${targetDir}`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
    }
    process.exit(1);
  });

  // Fire execution pipeline
  await finder.find(targetDir);
}