function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The name a file was uploaded with. Stored paths are "<prefix>-<timestamp>-<name>"
 * (see saveUpload); other paths, like seeded files, are returned as they are.
 */
export function uploadedFileName(filePath: string) {
  return filePath.match(/^.*?-\d{13}-(.+)$/)?.[1] ?? filePath;
}

/** "PDF · 2.4 MB", the type and size shown next to a file name. */
export function fileMeta(name: string, bytes: number) {
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "FILE";
  return `${ext} · ${formatBytes(bytes)}`;
}

/** File name for the response to a review cycle's comments. */
export const responseLetterFileName = (round: number) => `response-to-review-cycle-${round}.pdf`;
