import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/storage";
import { fail } from "@/lib/http";
import { parseCommentLetter } from "@/lib/parse-comment-letter";

// Records a comment letter from the jurisdiction. The letter arrives while the
// approval is under review, so uploading it moves the approval to `comments`.
// Its comments are extracted in the background (see CommentLetter.parseStatus).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) return fail(404, "Approval not found");
  if (approval.status !== "submitted") {
    return fail(409, "Comment letters can only be added while the approval is submitted");
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return fail(400, "Missing file");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return fail(400, "Comment letters must be PDFs");
  }

  const filePath = await saveUpload(file, `letter-${approval.id}`);
  const now = new Date();
  const document = await db.$transaction(async (tx) => {
    // Moving to comments first claims the approval: a second letter uploaded at
    // the same time waits on this row, then finds it moved and isn't recorded
    // as another letter for the same round.
    const { count } = await tx.approval.updateMany({
      where: { id: approval.id, status: "submitted" },
      data: { status: "comments" },
    });
    if (count === 0) return null;

    // The letter is the jurisdiction's review of the latest submission, so its
    // round is that submission's number.
    const { number: round } = await tx.submission.findFirstOrThrow({
      where: { approvalId: approval.id },
      orderBy: { number: "desc" },
    });
    return tx.document.create({
      data: {
        approvalId: approval.id,
        type: "comment_letter",
        name: file.name,
        filePath,
        uploadedAt: now,
        commentLetter: { create: { round, parseStartedAt: now } },
      },
    });
  });
  if (!document) {
    return fail(409, "Comment letters can only be added while the approval is submitted");
  }

  after(() => parseCommentLetter(document.id, now));

  return NextResponse.json(document, { status: 201 });
}
