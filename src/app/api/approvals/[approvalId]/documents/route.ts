import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { findEditableComment } from "@/lib/comments";
import { saveUpload } from "@/lib/storage";

// Uploads a new file for a comment's response (the "Upload new file" option):
// it joins the approval's package and is attached to that comment.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  const commentId = formData.get("commentId");
  if (!(file instanceof File)) return fail(400, "Missing file");
  if (typeof commentId !== "string") return fail(400, "Missing commentId");

  const found = await findEditableComment(commentId);
  if ("error" in found) return found.error;
  if (found.approval.id !== approvalId) return fail(404, "Comment not found on this approval");

  const filePath = await saveUpload(file, `approval-${approvalId}`);
  const document = await db.document.create({
    data: {
      approvalId,
      type: "submittal",
      name: file.name,
      filePath,
      uploadedAt: new Date(),
      submittal: {
        create: { status: "uploaded", comments: { connect: { id: commentId } } },
      },
    },
  });

  return NextResponse.json(document, { status: 201 });
}
