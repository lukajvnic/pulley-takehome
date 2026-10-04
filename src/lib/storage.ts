import fs from "node:fs/promises";
import path from "node:path";

/** Files the team and the jurisdiction upload. Served via /api/files/*. */
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/**
 * PDFs the app makes itself, like submitted response letters, kept apart from
 * user uploads. Served via /api/generated-pdfs/*.
 */
export const GENERATED_PDFS_DIR = path.join(process.cwd(), "generated-pdfs");

/** Writes `bytes` to `dir` as "<prefix>-<timestamp>-<name>" and returns that path. */
async function store(dir: string, prefix: string, name: string, bytes: Uint8Array) {
  const relativePath = `${prefix}-${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, relativePath), bytes);
  return relativePath;
}

export async function saveUpload(file: File, prefix: string): Promise<string> {
  return store(UPLOADS_DIR, prefix, file.name, new Uint8Array(await file.arrayBuffer()));
}

export function saveGeneratedPdf(pdf: Uint8Array, name: string, prefix: string) {
  return store(GENERATED_PDFS_DIR, prefix, name, pdf);
}

/** Size in bytes of a stored file, or 0 if it's missing. */
export async function fileSize(dir: string, relativePath: string): Promise<number> {
  const stats = await fs.stat(path.join(dir, relativePath)).catch(() => null);
  return stats?.size ?? 0;
}
