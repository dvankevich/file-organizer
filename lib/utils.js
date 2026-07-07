import readline from 'readline';

/**
 * Helper function to format bytes into a human-readable string
 * @param {number} bytes - The number of bytes to format
 * @returns {string} Formatted size (e.g., "1.2 MB")
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val < 10 && i > 0 ? val.toFixed(1) : Math.round(val)} ${sizes[i]}`;
}

/**
 * Renders the progress bar directly to the terminal line using your █░ style
 * @param {number} current - Current processed items count
 * @param {number} total - Total items count
 * @param {number} width - The visual width of the progress bar
 * @param {string} prefix - Text to show before the progress bar
 */
export function drawProgressBar(current, total, width = 20, prefix = 'Processing') {
  const safeTotal = total > 0 ? total : 1;
  const percentage = current / safeTotal;
  const filled = Math.min(Math.round(percentage * width), width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);

  // Clear line and move cursor to index 0 to avoid overlapping text bugs
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);

  // Write the complete updated progress line
  process.stdout.write(`${prefix}... ${bar} ${current}/${total} files`);
}

/**
 * Clears the current progress bar line from the terminal
 */
export function clearProgressBar() {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}