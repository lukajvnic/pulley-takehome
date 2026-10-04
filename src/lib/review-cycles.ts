import type { Prisma } from "@prisma/client";

/**
 * Records a submission to the jurisdiction: a new review cycle, holding the
 * files that haven't gone out in an earlier cycle. The first submission sends
 * the whole uploaded package; a response to comments sends only the files
 * attached to those comments.
 */
export async function startReviewCycle(
  client: Prisma.TransactionClient,
  approvalId: string,
  submittedAt: Date,
  { attachedOnly = false }: { attachedOnly?: boolean } = {}
) {
  const latest = await client.reviewCycle.findFirst({
    where: { approvalId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const cycle = await client.reviewCycle.create({
    data: { approvalId, number: (latest?.number ?? 0) + 1, submittedAt },
  });
  await client.submittalDocument.updateMany({
    where: {
      cycleId: null,
      status: "uploaded",
      document: { approvalId },
      ...(attachedOnly ? { comments: { some: {} } } : {}),
    },
    data: { cycleId: cycle.id },
  });
  return cycle;
}
