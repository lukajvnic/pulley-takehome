import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { displayNumber } from "@/lib/format";
import { LetterViewer } from "@/components/letter-viewer/LetterViewer";

export const dynamic = "force-dynamic";

/** A comment letter on its own page, with one of its comments highlighted (`?comment=`). */
export default async function LetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ letterId: string }>;
  searchParams: Promise<{ comment?: string }>;
}) {
  const { letterId } = await params;
  const { comment: commentId } = await searchParams;

  const letter = await db.commentLetter.findUnique({
    where: { documentId: letterId },
    include: { document: { include: { approval: true } } },
  });
  if (!letter) notFound();
  const comment = commentId
    ? await db.comment.findFirst({ where: { id: commentId, letterId } })
    : null;

  const { document } = letter;
  const fileUrl = `/api/files/${document.filePath}`;

  return (
    <div className="flex flex-col gap-6 text-ink">
      <div>
        <Link
          href={`/approvals/${document.approvalId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {document.approval.name}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{document.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">Review cycle {letter.round} comments</p>
          </div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 flex-none text-small text-accent hover:text-accent-hover"
          >
            Original PDF ↗
          </a>
        </div>
      </div>

      {comment && (
        <p className="flex items-center gap-2.5 text-small text-ink-secondary">
          <span className="size-3 flex-none rounded-xs bg-accent/25" aria-hidden="true" />
          <span className="font-mono text-ink-muted">{displayNumber(comment.number)}</span>
          <span className="truncate font-medium text-ink">{comment.title || comment.text}</span>
        </p>
      )}

      <LetterViewer
        fileUrl={fileUrl}
        target={comment && { text: comment.text, page: comment.page }}
      />
    </div>
  );
}
