import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { areProjectMembers, findLetter, readCommentFields } from "@/lib/comments";

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

// Edits a comment: its parsed fields, the team's response, `assigneeIds`, and
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
  const { assigneeIds, ...fields } = result.fields;
  if (assigneeIds && !(await areProjectMembers(approval.permit.projectId, assigneeIds))) {
    return NextResponse.json(
      { error: "Assignees must be members of the project" },
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
      ...(assigneeIds ? { assignees: { set: assigneeIds.map((id) => ({ id })) } } : {}),
      ...(attachmentIds !== undefined
        ? {
            attachments: {
              set: (attachmentIds as string[]).map((documentId) => ({ documentId })),
            },
          }
        : {}),
    },
    include: { assignees: true, attachments: { include: { document: true } } },
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
