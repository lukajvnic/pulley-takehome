import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { findEditableComment } from "@/lib/comments";
import { saveUpload } from "@/lib/storage";

// Adds a file to the response package while the team answers comments. Pass
// `commentId` to also attach it to that comment (the "Upload new file" option).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) return fail(404, "Approval not found");
  if (approval.status !== "comments") {
    return fail(409, "Files can only be added while responding to comments");
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail(400, "Missing file");
  const commentId = formData.get("commentId");
  if (commentId !== null) {
    if (typeof commentId !== "string") return fail(400, "commentId must be a string");
    const found = await findEditableComment(commentId);
    if ("error" in found) return found.error;
    if (found.approval.id !== approvalId) return fail(404, "Comment not found on this approval");
  }

  const filePath = await saveUpload(file, `approval-${approvalId}`);
  const document = await db.document.create({
    data: {
      approvalId,
      type: "submittal",
      name: file.name,
      filePath,
      uploadedAt: new Date(),
      submittal: {
        create: {
          status: "uploaded",
          ...(commentId ? { comments: { connect: { id: commentId } } } : {}),
        },
      },
    },
  });

  return NextResponse.json(document, { status: 201 });
}
