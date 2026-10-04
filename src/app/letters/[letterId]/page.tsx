import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { displayNumber } from "@/lib/format";
import { BackLink, ExternalLink } from "@/components/links";
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

  const [letter, comment] = await Promise.all([
    db.commentLetter.findUnique({
      where: { documentId: letterId },
      include: { document: { include: { approval: { select: { name: true } } } } },
    }),
    commentId ? db.comment.findFirst({ where: { id: commentId, letterId } }) : null,
  ]);
  if (!letter) notFound();

  const { document } = letter;
  const fileUrl = `/api/files/${document.filePath}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={`/approvals/${document.approvalId}`}>{document.approval.name}</BackLink>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{document.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">Review cycle {letter.round} comments</p>
          </div>
          <ExternalLink href={fileUrl} className="mt-1.5 flex-none">
            Original PDF
          </ExternalLink>
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
