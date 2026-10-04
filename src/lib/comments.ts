import { CommentType } from "@prisma/client";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";

/**
 * Loads a comment letter with its approval. Its comments are editable only
 * while it is the approval's current letter and the team is responding.
 */
export async function findLetter(letterId: string) {
  const letter = await db.commentLetter.findUnique({
    where: { documentId: letterId },
    include: { document: { include: { approval: { include: { permit: true } } } } },
  });
  if (!letter) return null;

  const approval = letter.document.approval;
  const latest = await db.commentLetter.findFirst({
    where: { document: { approvalId: approval.id } },
    orderBy: { round: "desc" },
    select: { documentId: true },
  });
  const editable =
    approval.status === "comments" && latest?.documentId === letter.documentId;

  return { letter, approval, editable };
}

export const notEditable = () =>
  fail(409, "Comments can only be changed on the current letter while responding");

/** Loads a comment for a change, or the error response if it can't be changed. */
export async function findEditableComment(commentId: string) {
  const comment = await db.comment.findUnique({ where: { id: commentId } });
  if (!comment) return { error: fail(404, "Comment not found") };
  const found = await findLetter(comment.letterId);
  if (!found?.editable) return { error: notEditable() };
  return { comment, approval: found.approval };
}

/** Only members of the project's team can be assigned its comments. */
export async function areProjectMembers(projectId: string, userIds: string[]) {
  const count = await db.projectMember.count({
    where: { projectId, userId: { in: userIds } },
  });
  return count === userIds.length;
}

/** Responses can reference the files uploaded to the approval's package. */
export async function arePackageFiles(approvalId: string, documentIds: string[]) {
  const count = await db.submittalDocument.count({
    where: {
      documentId: { in: documentIds },
      document: { approvalId },
      kind: "required_upload",
      status: "uploaded",
    },
  });
  return count === documentIds.length;
}

type CommentFields = {
  number?: string;
  text?: string;
  discipline?: string | null;
  title?: string | null;
  commentType?: CommentType;
  sheetRefs?: string[];
  codeRefs?: string[];
  response?: string | null;
  completed?: boolean;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

/** Trims a nullable string, storing blank as null. */
const blankToNull = (value: string | null) => value?.trim() || null;

/**
 * Validates a request body: the comment's own fields, plus the ids of its
 * assignees and attached files. Whatever is left out stays undefined, so the
 * result works for both create and update.
 */
export function readCommentFields(body: unknown):
  | { fields: CommentFields; assigneeIds?: string[]; attachmentIds?: string[] }
  | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Body must be a JSON object" };
  }
  const input = body as Record<string, unknown>;
  const fields: CommentFields = {};
  const ids: { assigneeIds?: string[]; attachmentIds?: string[] } = {};

  if (input.number !== undefined) {
    if (typeof input.number !== "string") return { error: "number must be a string" };
    fields.number = input.number.trim();
  }
  if (input.text !== undefined) {
    if (typeof input.text !== "string" || !input.text.trim()) {
      return { error: "text must be a non-empty string" };
    }
    fields.text = input.text.trim();
  }
  if (input.commentType !== undefined) {
    if (typeof input.commentType !== "string" || !Object.hasOwn(CommentType, input.commentType)) {
      return { error: `commentType must be one of: ${Object.keys(CommentType).join(", ")}` };
    }
    fields.commentType = input.commentType as CommentType;
  }
  if (input.completed !== undefined) {
    if (typeof input.completed !== "boolean") return { error: "completed must be a boolean" };
    fields.completed = input.completed;
  }
  for (const key of ["sheetRefs", "codeRefs", "assigneeIds", "attachmentIds"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (!isStringArray(value)) return { error: `${key} must be an array of strings` };
    const list = [...new Set(value)];
    if (key === "assigneeIds" || key === "attachmentIds") ids[key] = list;
    else fields[key] = list;
  }
  for (const key of ["discipline", "title", "response"] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") {
      return { error: `${key} must be a string or null` };
    }
    fields[key] = blankToNull(value);
  }

  return { fields, ...ids };
}
