import { GENERATED_PDFS_DIR } from "@/lib/storage";
import { serveFile } from "@/lib/serve-file";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  return serveFile(GENERATED_PDFS_DIR, segments);
}
