import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
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
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  if (approval.status !== "submitted") {
    return NextResponse.json(
      { error: "Comment letters can only be added while the approval is submitted" },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Comment letters must be PDFs" }, { status: 400 });
  }

  const filePath = await saveUpload(file, `letter-${approval.id}`);
  const letter = await db.$transaction(async (tx) => {
    // The letter is the jurisdiction's review of the latest submission, so its
    // round is that submission's number.
    const submission = await tx.submission.findFirst({
      where: { approvalId: approval.id },
      orderBy: { number: "desc" },
    });
    const round =
      submission?.number ??
      (await tx.commentLetter.count({ where: { document: { approvalId: approval.id } } })) + 1;
    const document = await tx.document.create({
      data: {
        approvalId: approval.id,
        type: "comment_letter",
        name: file.name,
        filePath,
        uploadedAt: new Date(),
        commentLetter: { create: { round } },
      },
      include: { commentLetter: true },
    });
    await tx.approval.update({
      where: { id: approval.id },
      data: { status: "comments" },
    });
    return document.commentLetter!;
  });

  after(() => parseCommentLetter(letter.documentId));

  return NextResponse.json(letter, { status: 201 });
}
