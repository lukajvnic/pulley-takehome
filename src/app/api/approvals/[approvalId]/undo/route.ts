import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Approval, ApprovalStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { GENERATED_PDFS_DIR, UPLOADS_DIR } from "@/lib/storage";
import { findOpenLetter } from "@/lib/submissions";

// Takes back the approval's last stage change, e.g. a button clicked by
// mistake. Returns the paths of stored files the change no longer needs, or
// null if the approval moved on meanwhile.
const undo: Record<
  Exclude<ApprovalStatus, "preparing">,
  (tx: Prisma.TransactionClient, approval: Approval) => Promise<string[] | null>
> = {
  // Back under review.
  async approved(tx, approval) {
    if (!(await claim(tx, approval, { status: "submitted", approvedAt: null }))) return null;
    return [];
  },

  // The comment letter is removed, with its comments and any responses.
  async comments(tx, approval) {
    if (!(await claim(tx, approval, { status: "submitted" }))) return null;
    const letter = await findOpenLetter(tx, approval.id);
    if (!letter) return [];
    const { filePath } = await tx.document.delete({ where: { id: letter.documentId } });
    return filePath ? [path.join(UPLOADS_DIR, filePath)] : [];
  },

  // The latest submission is withdrawn: its files go back to the package being
  // put together, and its response letter is dropped, to be generated again
  // on the next submit.
  async submitted(tx, approval) {
    const latest = await tx.submission.findFirst({
      where: { approvalId: approval.id },
      orderBy: { number: "desc" },
    });
    const previous =
      latest && latest.number > 1
        ? await tx.submission.findUnique({
            where: { approvalId_number: { approvalId: approval.id, number: latest.number - 1 } },
          })
        : null;
    const claimed = await claim(tx, approval, {
      status: previous ? "comments" : "preparing",
      submittedAt: previous?.submittedAt ?? null,
    });
    if (!claimed) return null;
    if (!latest) return [];

    const responseLetters = await tx.document.findMany({
      where: { submittal: { submissionId: latest.id, kind: "response_letter" } },
    });
    await tx.document.deleteMany({ where: { id: { in: responseLetters.map((d) => d.id) } } });
    await tx.submission.delete({ where: { id: latest.id } });
    return responseLetters.flatMap((d) =>
      d.filePath ? [path.join(GENERATED_PDFS_DIR, d.filePath)] : []
    );
  },
};

/** Moves the approval only if it's still in the status the undo was worked out from. */
async function claim(
  tx: Prisma.TransactionClient,
  approval: Approval,
  data: Prisma.ApprovalUpdateManyMutationInput
) {
  const { count } = await tx.approval.updateMany({
    where: { id: approval.id, status: approval.status },
    data,
  });
  return count > 0;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) return fail(404, "Approval not found");
  if (approval.status === "preparing") return fail(409, "There's nothing to undo");

  const status = approval.status;
  const unused = await db.$transaction((tx) => undo[status](tx, approval));
  if (!unused) return fail(409, "The approval changed. Refresh the page and try again.");

  await Promise.all(unused.map((file) => fs.rm(file, { force: true })));
  return new NextResponse(null, { status: 204 });
}
