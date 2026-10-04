import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import {
  areProjectMembers,
  arePackageFiles,
  findEditableComment,
  readCommentFields,
} from "@/lib/comments";

// Edits a comment: its parsed fields, the team's response, `assigneeIds`, and
// `attachmentIds`, the submittal documents the response references (replaces
// the current list).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const found = await findEditableComment(commentId);
  if ("error" in found) return found.error;
  const { comment, approval } = found;

  const result = readCommentFields(await request.json().catch(() => null));
  if ("error" in result) return fail(400, result.error);
  const { fields, assigneeIds, attachmentIds } = result;
  if (assigneeIds && !(await areProjectMembers(approval.permit.projectId, assigneeIds))) {
    return fail(400, "Assignees must be members of the project");
  }
  if (attachmentIds && !(await arePackageFiles(approval.id, attachmentIds))) {
    return fail(400, "Attachments must be files uploaded to this approval");
  }

  const updated = await db.comment.update({
    where: { id: comment.id },
    data: {
      ...fields,
      ...(assigneeIds ? { assignees: { set: assigneeIds.map((id) => ({ id })) } } : {}),
      ...(attachmentIds
        ? { attachments: { set: attachmentIds.map((documentId) => ({ documentId })) } }
        : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;
  const found = await findEditableComment(commentId);
  if ("error" in found) return found.error;

  await db.comment.delete({ where: { id: found.comment.id } });
  return new NextResponse(null, { status: 204 });
}
