import type { DocumentKind } from "@prisma/client";
import { db } from "@/lib/db";
import { fileMeta, uploadedFileName } from "@/lib/format";
import { fileSize, GENERATED_PDFS_DIR, UPLOADS_DIR } from "@/lib/storage";

export const loadApproval = (approvalId: string) =>
  db.approval.findUnique({
    where: { id: approvalId },
    include: {
      documents: {
        where: { type: "submittal" },
        include: { submittal: true },
        orderBy: { name: "asc" },
      },
      permit: { include: { project: true } },
    },
  });

export type ApprovalWithDocs = NonNullable<Awaited<ReturnType<typeof loadApproval>>>;

export const loadLetters = (approvalId: string) =>
  db.commentLetter.findMany({
    where: { document: { approvalId } },
    include: {
      document: true,
      comments: {
        orderBy: { position: "asc" },
        include: {
          assignees: { select: { id: true } },
          attachments: { select: { documentId: true } },
        },
      },
    },
  });

export type Letter = Awaited<ReturnType<typeof loadLetters>>[number];

export const loadSubmissions = (approvalId: string) =>
  db.submission.findMany({
    where: { approvalId },
    orderBy: { number: "desc" },
    include: { documents: { include: { document: true } } },
  });

/** The project team, who comments can be assigned to. */
export const loadMembers = async (projectId: string) =>
  (
    await db.projectMember.findMany({
      where: { projectId },
      select: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { user: { name: "asc" } },
    })
  ).map(({ user }) => user);

export const hasFile = <T extends { filePath: string | null }>(
  document: T
): document is T & { filePath: string } => document.filePath !== null;

/** A stored file as the lists show it: where to view it, its type and size, and its file name. */
export async function describeFile(document: {
  id: string;
  name: string;
  filePath: string;
  kind: DocumentKind;
}) {
  // Response letters are generated, so they live apart from uploads.
  const generated = document.kind === "response_letter";
  const size = await fileSize(generated ? GENERATED_PDFS_DIR : UPLOADS_DIR, document.filePath);
  return {
    id: document.id,
    name: document.name,
    href: `${generated ? "/api/generated-pdfs" : "/api/files"}/${document.filePath}`,
    meta: fileMeta(document.filePath, size),
    fileName: uploadedFileName(document.filePath),
  };
}
