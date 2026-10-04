import { serveFile } from "@/lib/serve-file";
import { UPLOADS_DIR } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  return serveFile(UPLOADS_DIR, segments);
}
