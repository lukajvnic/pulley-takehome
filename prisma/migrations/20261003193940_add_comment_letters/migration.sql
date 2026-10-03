-- Split Document into a base table plus subtype tables (SubmittalDocument,
-- CommentLetter), and add Comment. Existing documents become submittals, and
-- their kind/status move to SubmittalDocument before the old columns are dropped.

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('submittal', 'comment_letter');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('correction', 'informational', 'administrative');

-- CreateTable
CREATE TABLE "SubmittalDocument" (
    "documentId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'required_upload',
    "status" "DocumentStatus" NOT NULL DEFAULT 'needed',

    CONSTRAINT "SubmittalDocument_pkey" PRIMARY KEY ("documentId")
);

-- Backfill: every existing document is a submittal.
INSERT INTO "SubmittalDocument" ("documentId", "kind", "status")
SELECT "id", "kind", "status" FROM "Document";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "type" "DocumentType" NOT NULL DEFAULT 'submittal';
ALTER TABLE "Document" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Document" DROP COLUMN "kind",
DROP COLUMN "status";

-- CreateTable
CREATE TABLE "CommentLetter" (
    "documentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "letterDate" TIMESTAMP(3),
    "reviewerName" TEXT,
    "parseStatus" "ParseStatus" NOT NULL DEFAULT 'processing',
    "parseError" TEXT,

    CONSTRAINT "CommentLetter_pkey" PRIMARY KEY ("documentId")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "discipline" TEXT,
    "text" TEXT NOT NULL,
    "sheetRefs" TEXT[],
    "codeRefs" TEXT[],
    "commentType" "CommentType" NOT NULL DEFAULT 'correction',
    "response" TEXT,
    "assigneeId" TEXT,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CommentToSubmittalDocument" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CommentToSubmittalDocument_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CommentToSubmittalDocument_B_index" ON "_CommentToSubmittalDocument"("B");

-- AddForeignKey
ALTER TABLE "SubmittalDocument" ADD CONSTRAINT "SubmittalDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLetter" ADD CONSTRAINT "CommentLetter_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "CommentLetter"("documentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommentToSubmittalDocument" ADD CONSTRAINT "_CommentToSubmittalDocument_A_fkey" FOREIGN KEY ("A") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommentToSubmittalDocument" ADD CONSTRAINT "_CommentToSubmittalDocument_B_fkey" FOREIGN KEY ("B") REFERENCES "SubmittalDocument"("documentId") ON DELETE CASCADE ON UPDATE CASCADE;
