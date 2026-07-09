import { EventEmitter } from 'events';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { formatSize, drawProgressBar, clearProgressBar } from './utils.js';

// 10 MB threshold in bytes
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;

const CATEGORIES = {
  Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.pptx'],
  Images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp'],
  Archives: ['.zip', '.rar', '.tar', '.gz', '.7z'],
  Code: ['.js', '.py', '.java', '.cpp', '.html', '.css', '.json'],
  Videos: ['.mp4', '.avi', '.mkv', '.mov', '.webm'],
  Other: []
};

// ==========================================
// 1. CORE BUSINESS LOGIC (Pure Event Emitter)
// ==========================================
export class Organizer extends EventEmitter {
  async organize(sourceDir, targetDir) {
    try {
      // Validate source directory existence
      const sourceStat = await fs.stat(sourceDir);
      if (!sourceStat.isDirectory()) {
        throw new Error(`Source path "${sourceDir}" is not a directory.`);
      }

      // Step 1: Scan and filter all files from the source directory
      const relativePaths = await fs.readdir(sourceDir, { recursive: true });
      const filesToProcess = [];

      for (const relPath of relativePaths) {
        const fullPath = path.join(sourceDir, relPath);
        try {
          const fileStat = await fs.stat(fullPath);
          if (fileStat.isFile()) {
            filesToProcess.push({ fullPath, name: path.basename(fullPath), size: fileStat.size });
          }
        } catch (err) {
          // Skip individual files that are locked/inaccessible
        }
      }

      const totalFiles = filesToProcess.length;

      // Step 2: Create category folders inside the target directory
      this.emit('folders-creation-start');
      for (const category of Object.keys(CATEGORIES)) {
        const categoryFolderPath = path.join(targetDir, category);
        await fs.mkdir(categoryFolderPath, { recursive: true });
        this.emit('folder-created', { category });
      }

      // Initialize execution metrics summary
      const summary = {
        totalCopied: 0,
        totalSize: 0,
        byCategory: {}
      };
      
      for (const cat of Object.keys(CATEGORIES)) {
        summary.byCategory[cat] = { count: 0 };
      }

      // Step 3: Process and sort each file
      for (let i = 0; i < totalFiles; i++) {
        const file = filesToProcess[i];
        const ext = path.extname(file.fullPath).toLowerCase();
        
        // Find matching category
        let matchedCategory = 'Other';
        for (const [category, extensions] of Object.entries(CATEGORIES)) {
          if (extensions.includes(ext)) {
            matchedCategory = category;
            break;
          }
        }

        const targetFolder = path.join(targetDir, matchedCategory);
        const targetPath = await this._getUniqueTargetPath(targetFolder, file.name);

        this.emit('copy-start', { name: file.name, current: i + 1, total: totalFiles });

        try {
          if (file.size < LARGE_FILE_THRESHOLD) {
            // Fast copy for small files (< 10 MB)
            await fs.copyFile(file.fullPath, targetPath);
          } else {
            // Memory efficient stream pipeline copy for large files (>= 10 MB)
            await pipeline(
              fsSync.createReadStream(file.fullPath),
              fsSync.createWriteStream(targetPath)
            );
          }

          // Update success metrics
          summary.totalCopied++;
          summary.totalSize += file.size;
          summary.byCategory[matchedCategory].count++;

          this.emit('copy-complete', { name: file.name, current: i + 1, total: totalFiles });
        } catch (err) {
          this.emit('copy-error', { name: file.name, error: err.message });
        }
      }

      // Emit complete payload back to interface handler
      this.emit('organize-complete', { summary, targetDir });

    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Generates a non-conflicting unique path by appending windows-style (1) counters if file exists
   * @private
   */
  async _getUniqueTargetPath(targetFolder, filename) {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let counter = 0;
    let targetPath = path.join(targetFolder, filename);

    while (true) {
      try {
        await fs.access(targetPath);
        // File exists if line executes, increment unique index counter
        counter++;
        targetPath = path.join(targetFolder, `${base}(${counter})${ext}`);
      } catch (err) {
        // Safe to use: file does not exist (throws ENOENT)
        break;
      }
    }
    return targetPath;
  }
}

// ==========================================
// 2. CLI COMMAND HANDLER (UI & Orchestration)
// ==========================================
export async function handleOrganizeCommand(directory, options) {
  const sourceDir = path.resolve(directory);
  const targetDir = path.resolve(options.output);

  console.log(`📦 Organizing: ${sourceDir}`);
  console.log(`Target: ${targetDir}\n`);

  const organizer = new Organizer();

  // Event: Inform about directory initialization pipeline stage
  organizer.on('folders-creation-start', () => {
    console.log('Creating folders...');
  });

  organizer.on('folder-created', (data) => {
    console.log(`  ✓ ${data.category}/`);
  });

  // Events: Real-time atomic operation streaming tracking bound to utility progress-bar
  organizer.on('folders-creation-start', () => {}); // Handled above, but helps group sequence
  
  let foldersLogEnded = false;
  const ensureSpacing = () => {
    if (!foldersLogEnded) {
      console.log('\nCopying files...');
      foldersLogEnded = true;
    }
  };

  organizer.on('copy-start', (data) => {
    ensureSpacing();
    drawProgressBar(data.current, data.total, 20, 'Copying files');
  });

  organizer.on('copy-complete', (data) => {
    drawProgressBar(data.current, data.total, 20, 'Copying files');
  });

  // Event: Safe conclusion display rendering
  organizer.on('organize-complete', (data) => {
    const { summary } = data;
    clearProgressBar();

    console.log(`✅ Organization complete!`);
    console.log(`\nSummary:`);
    
    // Dynamically retrieve directory structure representations 
    const relativeTargetName = path.basename(data.targetDir);
    
    for (const [category, catData] of Object.entries(summary.byCategory)) {
      const padding = category.padEnd(11);
      const fileCountStr = String(catData.count).padStart(3);
      console.log(`  ${padding}: ${fileCountStr} files → ${relativeTargetName}/${category}/`);
    }

    console.log(`\nTotal copied: ${summary.totalCopied} files (${formatSize(summary.totalSize)})`);
  });

  // Event: Unrecoverable validation crashes or target folder lockouts
  organizer.on('error', (error) => {
    process.stdout.write('\n');
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: Source directory not found: ${sourceDir}`);
    } else if (error.code === 'EACCES') {
      console.error(`❌ Error: Permission denied checking files.`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}`);
    }
    process.exit(1);
  });

  // Fire organizing machine engine instance
  await organizer.organize(sourceDir, targetDir);
}