import type { Prisma } from "@prisma/client";

/**
 * Records a package sent to the jurisdiction, holding the files uploaded since
 * the last one: the whole package for the initial submittal, then the files
 * added while answering each set of comments.
 */
export async function recordSubmission(
  client: Prisma.TransactionClient,
  approvalId: string,
  submittedAt: Date
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
    where: { submissionId: null, status: "uploaded", document: { approvalId } },
    data: { submissionId: submission.id },
  });
  return submission;
}
