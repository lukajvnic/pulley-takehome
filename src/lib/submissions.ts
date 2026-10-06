import type { Prisma } from "@prisma/client";

/** The number of the approval's latest submission, or 0 before the initial submittal. */
export async function latestSubmissionNumber(
  client: Prisma.TransactionClient,
  approvalId: string
) {
  const latest = await client.submission.findFirst({
    where: { approvalId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return latest?.number ?? 0;
}

/**
 * The comment letter the team is answering: the jurisdiction's review of the
 * latest submission. A letter on an earlier one was answered by the submission
 * after it.
 */
export async function findOpenLetter(client: Prisma.TransactionClient, approvalId: string) {
  const round = await latestSubmissionNumber(client, approvalId);
  return client.commentLetter.findFirst({ where: { round, document: { approvalId } } });
}

/**
 * Records a package sent to the jurisdiction, holding the files uploaded since
 * the last one: the whole package for the initial submittal, then the files
 * added while answering each set of comments. `documentIds` narrows it to the
 * files a response letter lists, so one uploaded after the letter was rendered
 * waits for the next submission instead of going out unlisted.
 */
export async function recordSubmission(
  client: Prisma.TransactionClient,
  approvalId: string,
  submittedAt: Date,
  documentIds?: string[]
) {
  const number = (await latestSubmissionNumber(client, approvalId)) + 1;
  const submission = await client.submission.create({
    data: { approvalId, number, submittedAt },
  });
  await client.submittalDocument.updateMany({
    where: {
      submissionId: null,
      status: "uploaded",
      document: { approvalId },
      ...(documentIds && { documentId: { in: documentIds } }),
    },
    data: { submissionId: submission.id },
  });
  return submission;
}
