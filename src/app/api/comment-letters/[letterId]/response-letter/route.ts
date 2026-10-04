import { NextResponse } from "next/server";
import { findLetter } from "@/lib/comments";
import { fail } from "@/lib/http";
import { renderResponseLetter } from "@/lib/response-letter";

// Downloads the response letter as it stands, generated fresh from the saved
// responses each time. Nothing is written to disk; the copy that goes to the
// jurisdiction is stored when the response is submitted.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ letterId: string }> }
) {
  const { letterId } = await params;
  const found = await findLetter(letterId);
  if (!found) return fail(404, "Comment letter not found");

  // While responses can still change, the PDF is a draft.
  const { pdf, fileName } = await renderResponseLetter(letterId, { draft: found.editable });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
