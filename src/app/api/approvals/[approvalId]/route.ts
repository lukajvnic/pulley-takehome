import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { renderResponseLetter } from "@/lib/response-letter";
import { findOpenLetter, recordSubmission } from "@/lib/submissions";
import { saveGeneratedPdf } from "@/lib/storage";
import { fail } from "@/lib/http";

// Simplistic status changes: any status can move to any other status.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> }
) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) return fail(404, "Approval not found");

  const body = await request.json().catch(() => null);
  if (typeof body?.status !== "string" || !Object.hasOwn(ApprovalStatus, body.status)) {
    return fail(400, `status must be one of: ${Object.keys(ApprovalStatus).join(", ")}`);
  }
  const status: ApprovalStatus = body.status;

  // Every move into submitted sends a package to the jurisdiction: it records a
  // submission, and submittedAt tracks the latest one.
  const submitting = status === "submitted" && approval.status !== "submitted";
  const responding = submitting && approval.status === "comments";
  const now = new Date();

  // A response goes out with its letter, generated once more from the final
  // responses and stored as the copy that was sent. Rendering happens before
  // the transaction so it isn't held open. Only a letter on the latest
  // submission is still unanswered.
  const letter = responding ? await findOpenLetter(db, approval.id) : null;
  // Until parsing finishes there's nothing to answer yet.
  if (letter?.parseStatus === "processing") {
    return fail(409, "The comment letter is still being read");
  }

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
      // Every submission records the package it sends; an answer to comments
      // sends the files its letter lists, and the letter itself.
      const submission = await recordSubmission(tx, approval.id, now, response?.enclosedIds);
      if (responsePath) {
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
