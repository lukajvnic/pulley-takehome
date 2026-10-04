import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { renderResponseLetter } from "@/lib/response-letter";
import { recordSubmission } from "@/lib/submissions";
import { saveGeneratedPdf } from "@/lib/generated-pdfs";

// Simplistic status changes: any status can move to any other status.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!status || !(status in ApprovalStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${Object.keys(ApprovalStatus).join(", ")}` },
      { status: 400 }
    );
  }

  // Every move into submitted sends a package to the jurisdiction: it records a
  // submission, and submittedAt tracks the latest one.
  const submitting = status === "submitted" && approval.status !== "submitted";
  const responding = submitting && approval.status === "comments";
  const now = new Date();

  // A response goes out with its letter, generated once more from the final
  // responses and stored as the copy that was sent. Rendering happens before
  // the transaction so it isn't held open.
  const letter = responding
    ? await db.commentLetter.findFirst({
        where: { document: { approvalId: approval.id } },
        orderBy: { round: "desc" },
      })
    : null;

  // Corrections not marked completed would go out unanswered. The client asks
  // the team to confirm first, then resends with `confirmUnanswered`.
  if (letter && body?.confirmUnanswered !== true) {
    const unanswered = await db.comment.count({
      where: { letterId: letter.documentId, commentType: "correction", completed: false },
    });
    if (unanswered > 0) {
      return NextResponse.json(
        { error: "Some corrections haven't been answered", unanswered },
        { status: 409 }
      );
    }
  }
  const response = letter
    ? await renderResponseLetter(letter.documentId, { draft: false, date: now })
    : null;
  const responsePath = response
    ? await saveGeneratedPdf(response.pdf, response.fileName, `response-${approval.id}`)
    : null;

  const updated = await db.$transaction(async (tx) => {
    if (submitting) {
      // Moving on from comments means sending the response, with its attachments.
      const submission = await recordSubmission(tx, approval.id, now, {
        attachedOnly: responding,
      });
      if (response && responsePath) {
        await tx.document.create({
          data: {
            approvalId: approval.id,
            type: "submittal",
            name: "Response letter",
            filePath: responsePath,
            uploadedAt: now,
            submittal: {
              create: {
                kind: "response_letter",
                status: "uploaded",
                submissionId: submission.id,
              },
            },
          },
        });
      }
    }
    return tx.approval.update({
      where: { id: approval.id },
      data: {
        status,
        ...(submitting ? { submittedAt: now } : {}),
        ...(status === "approved" && !approval.approvedAt ? { approvedAt: now } : {}),
      },
    });
  });

  return NextResponse.json(updated);
}
