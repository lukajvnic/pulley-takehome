-- Comments can have several assignees. Existing assignees move to the join
-- table before the old column is dropped.

-- CreateTable
CREATE TABLE "_CommentAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CommentAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- Backfill: A is the comment, B the user.
INSERT INTO "_CommentAssignees" ("A", "B")
SELECT "id", "assigneeId" FROM "Comment" WHERE "assigneeId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "_CommentAssignees_B_index" ON "_CommentAssignees"("B");

-- AddForeignKey
ALTER TABLE "_CommentAssignees" ADD CONSTRAINT "_CommentAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommentAssignees" ADD CONSTRAINT "_CommentAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_assigneeId_fkey";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "assigneeId";
