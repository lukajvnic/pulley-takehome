import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { saveUpload } from "@/lib/storage";

// Fills a checklist item of the initial package. Files that are already in
// can't be replaced, since they may have gone out with a submission.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const document = await db.document.findUnique({
    where: { id: documentId },
    include: { submittal: true },
  });
  if (!document?.submittal) return fail(404, "Document not found");
  if (document.submittal.status !== "needed") return fail(409, "This file is already uploaded");

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail(400, "Missing file");

  const filePath = await saveUpload(file, `doc-${document.id}`);
  const updated = await db.document.update({
    where: { id: document.id },
    data: {
      filePath,
      uploadedAt: new Date(),
      submittal: { update: { status: "uploaded" } },
    },
  });

  return NextResponse.json(updated);
}
