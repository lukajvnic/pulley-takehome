function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "PDF · 2.4 MB", the type and size shown next to a file name. */
export function fileMeta(name: string, bytes: number) {
  const ext = name.includes(".") ? name.split(".").pop()!.toUpperCase() : "FILE";
  return `${ext} · ${formatBytes(bytes)}`;
}
