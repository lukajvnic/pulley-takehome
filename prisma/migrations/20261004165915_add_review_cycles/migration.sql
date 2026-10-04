-- Each submission to the jurisdiction starts a review cycle, which records the
-- files that went out with it.

-- AlterTable
ALTER TABLE "SubmittalDocument" ADD COLUMN     "cycleId" TEXT;

-- CreateTable
CREATE TABLE "ReviewCycle" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCycle_approvalId_number_key" ON "ReviewCycle"("approvalId", "number");

-- AddForeignKey
ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmittalDocument" ADD CONSTRAINT "SubmittalDocument_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill cycles for approvals that already went out: one per comment letter,
-- plus one more if the latest letter's response was submitted. Past submission
-- dates weren't recorded, so they all take the approval's latest submittedAt.
INSERT INTO "ReviewCycle" ("id", "approvalId", "number", "submittedAt")
SELECT gen_random_uuid()::text, counts."approvalId", n, counts."submittedAt"
FROM (
    SELECT a."id" AS "approvalId",
           COALESCE(a."submittedAt", CURRENT_TIMESTAMP) AS "submittedAt",
           (SELECT COUNT(*) FROM "CommentLetter" l
              JOIN "Document" d ON d."id" = l."documentId"
             WHERE d."approvalId" = a."id")
           + CASE WHEN a."status" = 'comments' THEN 0 ELSE 1 END AS "cycles"
      FROM "Approval" a
     WHERE a."status" <> 'preparing'
) counts
CROSS JOIN generate_series(1, counts."cycles") AS n;

-- Backfill files: ones attached to a response to letter k went out in cycle
-- k + 1; every other uploaded file went out in cycle 1. Files whose cycle hasn't
-- started yet (a response still being written) stay unassigned.
UPDATE "SubmittalDocument" s
   SET "cycleId" = rc."id"
  FROM "Document" d, "ReviewCycle" rc
 WHERE d."id" = s."documentId"
   AND s."status" = 'uploaded'
   AND rc."approvalId" = d."approvalId"
   AND rc."number" = COALESCE((
         SELECT MAX(l."round") + 1
           FROM "_CommentToSubmittalDocument" j
           JOIN "Comment" c ON c."id" = j."A"
           JOIN "CommentLetter" l ON l."documentId" = c."letterId"
          WHERE j."B" = s."documentId"
       ), 1);
