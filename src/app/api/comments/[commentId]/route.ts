import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findLetter, isProjectMember, readCommentFields } from "@/lib/comments";

async function findEditableComment(commentId: string) {
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    return { error: NextResponse.json({ error: "Comment not found" }, { status: 404 }) };
  }
  const found = await findLetter(comment.letterId);
  if (!found?.editable) {
    return {
      error: NextResponse.json(
        { error: "Comments can only be changed on the current letter while responding" },
        { status: 409 }
      ),
    };
  }
  return { comment, approval: found.approval };
}

// Edits a comment: its parsed fields, the team's response, the assignee, and
// `attachmentIds`, the submittal documents the response references (replaces
// the current list).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const found = await findEditableComment(commentId);
  if (found.error) return found.error;
  const { comment, approval } = found;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  const result = readCommentFields(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { fields } = result;
  if (
    fields.assigneeId &&
    !(await isProjectMember(approval.permit.projectId, fields.assigneeId))
  ) {
    return NextResponse.json(
      { error: "Assignee must be a member of the project" },
      { status: 400 }
    );
  }

  const attachmentIds: unknown = body.attachmentIds;
  if (attachmentIds !== undefined) {
    if (!Array.isArray(attachmentIds) || !attachmentIds.every((id) => typeof id === "string")) {
      return NextResponse.json(
        { error: "attachmentIds must be an array of document ids" },
        { status: 400 }
      );
    }
    const ids = [...new Set(attachmentIds as string[])];
    const matching = await db.document.count({
      where: { id: { in: ids }, approvalId: approval.id, type: "submittal" },
    });
    if (matching !== ids.length) {
      return NextResponse.json(
        { error: "Attachments must be submittal documents on this approval" },
        { status: 400 }
      );
    }
  }

  const updated = await db.comment.update({
    where: { id: comment.id },
    data: {
      ...fields,
      ...(attachmentIds !== undefined
        ? {
            attachments: {
              set: (attachmentIds as string[]).map((documentId) => ({ documentId })),
            },
          }
        : {}),
    },
    include: { attachments: { include: { document: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const found = await findEditableComment(commentId);
  if (found.error) return found.error;

  await db.comment.delete({ where: { id: found.comment.id } });
  return new NextResponse(null, { status: 204 });
}
