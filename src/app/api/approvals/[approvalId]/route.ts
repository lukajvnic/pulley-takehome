import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { renderResponseLetter } from "@/lib/response-letter";
import { startReviewCycle } from "@/lib/review-cycles";
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

  // Every move into submitted is a new trip to the jurisdiction: it starts a
  // review cycle, and submittedAt tracks the latest one.
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
  const response = letter
    ? await renderResponseLetter(letter.documentId, { draft: false, date: now })
    : null;
  const responsePath = response
    ? await saveGeneratedPdf(response.pdf, response.fileName, `response-${approval.id}`)
    : null;

  const updated = await db.$transaction(async (tx) => {
    if (submitting) {
      // Moving on from comments means sending the response, with its attachments.
      const cycle = await startReviewCycle(tx, approval.id, now, { attachedOnly: responding });
      if (response && responsePath) {
        await tx.document.create({
          data: {
            approvalId: approval.id,
            type: "submittal",
            name: `Response to review cycle ${response.round} comments`,
            filePath: responsePath,
            uploadedAt: now,
            submittal: {
              create: { kind: "response_letter", status: "uploaded", cycleId: cycle.id },
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
