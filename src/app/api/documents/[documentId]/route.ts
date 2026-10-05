import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { UPLOADS_DIR } from "@/lib/storage";

// Takes a file back out of the response package before it's sent, e.g. one
// added by mistake or no longer attached to any comment.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { submittal: true, approval: true },
  });
  if (!document?.submittal || document.submittal.kind !== "required_upload") {
    return fail(404, "File not found");
  }
  const { status, submissionId } = document.submittal;
  if (document.approval.status !== "comments" || status !== "uploaded" || submissionId) {
    return fail(409, "Only files that haven't been submitted can be removed");
  }

  await db.document.delete({ where: { id: document.id } });
  if (document.filePath) {
    await fs.rm(path.join(UPLOADS_DIR, document.filePath), { force: true });
  }
  return new NextResponse(null, { status: 204 });
}
