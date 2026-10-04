import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { startReviewCycle } from "@/lib/review-cycles";

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
  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    if (submitting) {
      // Moving on from comments means sending the response, with its attachments.
      await startReviewCycle(tx, approval.id, now, {
        attachedOnly: approval.status === "comments",
      });
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
