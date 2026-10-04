import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const contentTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
};

/** Serves a stored file from `dir` for viewing in the browser. */
export async function serveFile(dir: string, segments: string[]) {
  const filePath = path.join(dir, ...segments);

  // Prevent path traversal outside the directory.
  if (!path.resolve(filePath).startsWith(path.resolve(dir) + path.sep)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentTypes[ext] ?? "application/octet-stream",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
