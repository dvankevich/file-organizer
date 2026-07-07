import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { formatSize, drawProgressBar, clearProgressBar } from './utils.js';

// ==========================================
// 1. CORE BUSINESS LOGIC (Pure Event Emitter)
// ==========================================
export class Scanner extends EventEmitter {
  async scan(directory) {
    // Emit start event before performing any filesystem operations
    this.emit('scan-start', { directory });

    try {
      // Read all relative paths inside the directory recursively
      const relativePaths = await fs.readdir(directory, { recursive: true });
      const filePaths = [];

      // Filter and separate files from directories safely
      for (const relPath of relativePaths) {
        const fullPath = path.join(directory, relPath);
        try {
          const fileStat = await fs.stat(fullPath);
          if (fileStat.isFile()) {
            filePaths.push({ fullPath, name: path.basename(fullPath) });
          }
        } catch (err) {
          // Non-fatal error: skip specific file if it's locked by OS or inaccessible
          this.emit('file-error', { path: fullPath, error: err.message });
        }
      }

      const totalFiles = filePaths.length;
      
      const statistics = {
        totalFiles: 0,
        totalSize: 0,
        byType: new Map(),
        ageGroups: {
          last7: 0,
          last30: 0,
          mid31to90: 0,
          older90: 0
        },
        allFiles: []
      };

      const now = new Date();

      // Process metadata for each confirmed file
      for (const file of filePaths) {
        try {
          const fileStat = await fs.stat(file.fullPath);
          const size = fileStat.size;
          const mtime = fileStat.mtime;
          const ext = path.extname(file.fullPath).toLowerCase() || '(no extension)';

          statistics.totalFiles++;
          statistics.totalSize += size;

          if (!statistics.byType.has(ext)) {
            statistics.byType.set(ext, { count: 0, totalSize: 0 });
          }
          const typeData = statistics.byType.get(ext);
          typeData.count++;
          typeData.totalSize += size;

          const diffDays = Math.floor((now - mtime) / (1000 * 60 * 60 * 24));

          if (diffDays <= 7) {
            statistics.ageGroups.last7++;
          } else if (diffDays <= 30) {
            statistics.ageGroups.last30++;
          } else if (diffDays <= 90) {
            statistics.ageGroups.mid31to90++;
          } else {
            statistics.ageGroups.older90++;
          }

          statistics.allFiles.push({
            name: file.name,
            size,
            ageDays: diffDays
          });

          // Emit event for real-time progress rendering in UI
          this.emit('file-found', {
            path: file.fullPath,
            size,
            current: statistics.totalFiles,
            total: totalFiles
          });

        } catch (err) {
          this.emit('file-error', { path: file.fullPath, error: err.message });
        }
      }

      // Finalize metric calculations (Top-3 largest files)
      statistics.largestFiles = [...statistics.allFiles]
        .sort((a, b) => b.size - a.size)
        .slice(0, 3);

      // Find the oldest file
      statistics.oldestFile = statistics.allFiles.reduce((oldest, current) => {
        return (!oldest || current.ageDays > oldest.ageDays) ? current : oldest;
      }, null);

      delete statistics.allFiles; // Free memory allocation before sending payload

      this.emit('scan-complete', {
        totalFiles,
        stats: statistics
      });

    } catch (error) {
      this.emit('error', error);
    }
  }
}

// ==========================================
// 2. CLI COMMAND HANDLER (UI & Orchestration)
// ==========================================
export async function handleScanCommand(directory) {
  const targetDir = path.resolve(directory);
  const scanner = new Scanner();

  // Event: Scanning process started
  scanner.on('scan-start', (data) => {
    console.log(`📂 Scanning: ${data.directory}`);
  });

  // Event: Single file was processed
  scanner.on('file-found', (data) => {
    drawProgressBar(data.current, data.total, 20, 'Processing');
  });

  // Event: Operations finished successfully, display formatted results
  scanner.on('scan-complete', (data) => {
    const { stats } = data;
    
    // Wipe the progress bar line completely using the direct function
    clearProgressBar(); 
    
    console.log(`📊 Scan Results:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total files: ${stats.totalFiles}`);
    console.log(`Total size:  ${formatSize(stats.totalSize)}`);
    
    console.log(`\nBy File Type:`);
    const sortedTypes = [...stats.byType.entries()].sort((a, b) => b[1].count - a[1].count);
    
    // Dynamically find the longest extension string length for perfect UI padding alignment
    const maxExtLength = Math.max(...sortedTypes.map(([ext]) => ext.length), 14);

    sortedTypes.forEach(([ext, typeData]) => {
      console.log(`  ${ext.padEnd(maxExtLength)} ${String(typeData.count).padStart(5)} files   ${formatSize(typeData.totalSize).padStart(10)}`);
    });

    console.log(`\nFile Age:`);
    console.log(`  Last 7 days:    ${stats.ageGroups.last7} files`);
    console.log(`  Last 30 days:   ${stats.ageGroups.last30} files`);
    if (stats.ageGroups.mid31to90 > 0) {
      console.log(`  31-90 days:     ${stats.ageGroups.mid31to90} files`);
    }
    console.log(`  Older than 90:  ${stats.ageGroups.older90} files`);

    console.log(`\nLargest files:`);
    stats.largestFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.name.padEnd(30)} ${formatSize(file.size).padStart(8)}`);
    });

    if (stats.oldestFile) {
      console.log(`\nOldest file: ${stats.oldestFile.name} (modified ${stats.oldestFile.ageDays} days ago)`);
    }
  });

  // Event: Critical business logic system errors
  scanner.on('error', (error) => {
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

  // Execute the underlying process
  await scanner.scan(targetDir);
}