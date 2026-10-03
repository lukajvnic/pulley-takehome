import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findLetter } from "@/lib/comments";
import { saveUpload } from "@/lib/uploads";

// Adds a new file to the approval's submission package. Pass `commentId` to
// also attach it to that comment's response (the "Upload new…" option).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const commentId = formData.get("commentId");
  if (commentId !== null) {
    const comment =
      typeof commentId === "string"
        ? await db.comment.findUnique({ where: { id: commentId } })
        : null;
    const found = comment && (await findLetter(comment.letterId));
    if (!found || found.approval.id !== approval.id) {
      return NextResponse.json(
        { error: "Comment not found on this approval" },
        { status: 400 }
      );
    }
    if (!found.editable) {
      return NextResponse.json(
        { error: "Comments can only be changed on the current letter while responding" },
        { status: 409 }
      );
    }
  }

  const filePath = await saveUpload(file, `approval-${approval.id}`);
  const document = await db.document.create({
    data: {
      approvalId: approval.id,
      type: "submittal",
      name: file.name,
      filePath,
      uploadedAt: new Date(),
      submittal: {
        create: {
          status: "uploaded",
          ...(typeof commentId === "string"
            ? { comments: { connect: { id: commentId } } }
            : {}),
        },
      },
    },
    include: { submittal: true },
  });

  return NextResponse.json(document, { status: 201 });
}
