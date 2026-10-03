import fs from "node:fs/promises";
import path from "node:path";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function saveUpload(file: File, prefix: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativePath = `${prefix}-${Date.now()}-${safeName}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOADS_DIR, relativePath), bytes);
  return relativePath;
}
