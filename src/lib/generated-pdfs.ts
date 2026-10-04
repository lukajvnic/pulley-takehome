import fs from "node:fs/promises";
import path from "node:path";

/**
 * PDFs the app makes itself, like submitted response letters, kept apart from
 * user uploads. Served via /api/generated-pdfs/*.
 */
export const GENERATED_PDFS_DIR = path.join(process.cwd(), "generated-pdfs");

/** Stores a generated PDF, named like uploads: "<prefix>-<timestamp>-<name>". */
export async function saveGeneratedPdf(pdf: Uint8Array, name: string, prefix: string) {
  const relativePath = `${prefix}-${Date.now()}-${name}`;
  await fs.mkdir(GENERATED_PDFS_DIR, { recursive: true });
  await fs.writeFile(path.join(GENERATED_PDFS_DIR, relativePath), pdf);
  return relativePath;
}

/** Size in bytes of a generated PDF, or 0 if it's missing. */
export async function generatedPdfSize(relativePath: string): Promise<number> {
  const stats = await fs.stat(path.join(GENERATED_PDFS_DIR, relativePath)).catch(() => null);
  return stats?.size ?? 0;
}
