export function cleanupFiles(directory, options) {
  const { days, dryRun } = options;
  console.log(`[Cleanup] Очищення директорії: ${directory}`);
  console.log(`[Cleanup] Параметри -> Кількість днів: ${days}, Режим dry-run: ${!!dryRun}`);
  // TODO: пошук та видалення файлів старіших за N днів з підтримкою dry-run
}