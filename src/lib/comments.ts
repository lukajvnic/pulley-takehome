import { CommentType } from "@prisma/client";
import { db } from "@/lib/db";

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

/** Only members of the project's team can be assigned its comments. */
export async function areProjectMembers(projectId: string, userIds: string[]) {
  const count = await db.projectMember.count({
    where: { projectId, userId: { in: userIds } },
  });
  return count === userIds.length;
}

export type CommentFields = {
  number?: string;
  text?: string;
  discipline?: string | null;
  title?: string | null;
  commentType?: CommentType;
  sheetRefs?: string[];
  codeRefs?: string[];
  response?: string | null;
  completed?: boolean;
  assigneeIds?: string[];
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

/** Trims a nullable string, storing blank as null. */
const blankToNull = (value: string | null) => value?.trim() || null;

/**
 * Validates the comment fields present in a request body. Fields that are
 * left out stay undefined, so the result works for both create and update.
 */
export function readCommentFields(
  body: Record<string, unknown>
): { fields: CommentFields } | { error: string } {
  const fields: CommentFields = {};

  if (body.number !== undefined) {
    if (typeof body.number !== "string") return { error: "number must be a string" };
    fields.number = body.number.trim();
  }
  if (body.text !== undefined) {
    if (typeof body.text !== "string" || !body.text.trim()) {
      return { error: "text must be a non-empty string" };
    }
    fields.text = body.text.trim();
  }
  if (body.commentType !== undefined) {
    if (typeof body.commentType !== "string" || !(body.commentType in CommentType)) {
      return { error: `commentType must be one of: ${Object.keys(CommentType).join(", ")}` };
    }
    fields.commentType = body.commentType as CommentType;
  }
  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") return { error: "completed must be a boolean" };
    fields.completed = body.completed;
  }
  for (const key of ["sheetRefs", "codeRefs", "assigneeIds"] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (!isStringArray(value)) return { error: `${key} must be an array of strings` };
    fields[key] = key === "assigneeIds" ? [...new Set(value)] : value;
  }
  for (const key of ["discipline", "title", "response"] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") {
      return { error: `${key} must be a string or null` };
    }
    fields[key] = blankToNull(value);
  }

  return { fields };
}
