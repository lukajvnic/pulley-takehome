import type { Prisma } from "@prisma/client";

/**
 * Records a package sent to the jurisdiction, holding the files that haven't
 * gone out before. The initial submittal sends the whole uploaded package; a
 * resubmittal answering comments sends only the files attached to them.
 */
export async function recordSubmission(
  client: Prisma.TransactionClient,
  approvalId: string,
  submittedAt: Date,
  { attachedOnly = false }: { attachedOnly?: boolean } = {}
) {
  const latest = await client.submission.findFirst({
    where: { approvalId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const submission = await client.submission.create({
    data: { approvalId, number: (latest?.number ?? 0) + 1, submittedAt },
  });
  await client.submittalDocument.updateMany({
    where: {
      submissionId: null,
      status: "uploaded",
      document: { approvalId },
      ...(attachedOnly ? { comments: { some: {} } } : {}),
    },
    data: { submissionId: submission.id },
  });
  return submission;
}
