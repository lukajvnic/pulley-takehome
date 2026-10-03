import fs from "node:fs/promises";
import path from "node:path";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

/** Size in bytes of an uploaded file, or 0 if it's missing. */
export async function uploadSize(relativePath: string): Promise<number> {
  const stats = await fs.stat(path.join(UPLOADS_DIR, relativePath)).catch(() => null);
  return stats?.size ?? 0;
}

export async function saveUpload(file: File, prefix: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativePath = `${prefix}-${Date.now()}-${safeName}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOADS_DIR, relativePath), bytes);
  return relativePath;
}
