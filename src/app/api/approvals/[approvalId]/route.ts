import { NextResponse } from "next/server";
import { ApprovalStatus } from "@prisma/client";
import { db } from "@/lib/db";

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

  const updated = await db.approval.update({
    where: { id: approval.id },
    data: {
      status,
      ...(status === "submitted" && !approval.submittedAt
        ? { submittedAt: new Date() }
        : {}),
      ...(status === "approved" && !approval.approvedAt
        ? { approvedAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json(updated);
}
