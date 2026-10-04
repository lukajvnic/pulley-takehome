-- A review cycle row is really one submission to the jurisdiction (submission 1
-- is the initial submittal), so it's renamed in place; no data changes.

ALTER TABLE "ReviewCycle" RENAME TO "Submission";
ALTER TABLE "Submission" RENAME CONSTRAINT "ReviewCycle_pkey" TO "Submission_pkey";
ALTER TABLE "Submission" RENAME CONSTRAINT "ReviewCycle_approvalId_fkey" TO "Submission_approvalId_fkey";
ALTER INDEX "ReviewCycle_approvalId_number_key" RENAME TO "Submission_approvalId_number_key";

ALTER TABLE "SubmittalDocument" RENAME COLUMN "cycleId" TO "submissionId";
ALTER TABLE "SubmittalDocument" RENAME CONSTRAINT "SubmittalDocument_cycleId_fkey" TO "SubmittalDocument_submissionId_fkey";
