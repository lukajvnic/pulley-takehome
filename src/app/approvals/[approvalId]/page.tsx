import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatusPill } from "@/components/StatusPill";
import type { ReactNode } from "react";
import type { DocumentKind } from "@prisma/client";
import { StageActions } from "@/components/StageActions";
import { DownloadButton } from "@/components/DownloadButton";
import { UploadButton } from "@/components/UploadButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CommentLedger } from "@/components/CommentLedger";
import type { LedgerComment, LedgerFile, Member } from "@/components/CommentRow";
import { fileMeta, responseLetterFileName, uploadedFileName } from "@/lib/format";
import { uploadSize } from "@/lib/uploads";
import { generatedPdfSize } from "@/lib/generated-pdfs";

export const dynamic = "force-dynamic";

const longDate = (d: Date) =>
  d.toLocaleDateString("en-US", { dateStyle: "long" });

function daysSince(d: Date) {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({
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
  if (!approval) notFound();

  const project = approval.permit.project;

  return (
    <div>
      <Link
        href={`/projects/${project.id}`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← {project.name}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{approval.name}</h1>
            <StatusPill status={approval.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {approval.permit.name}
            {approval.permit.permitNumber ? ` · ${approval.permit.permitNumber}` : ""}
            {` · ${project.ahjName}`}
          </p>
        </div>
        <StageActions approvalId={approval.id} status={approval.status} />
      </div>

      <div className="mt-8">
        {approval.status === "preparing" && <Preparing approval={approval} />}
        {approval.status === "submitted" && <Submitted approval={approval} />}
        {approval.status === "comments" && <Comments approval={approval} />}
        {approval.status === "approved" && <Approved approval={approval} />}
      </div>
    </div>
  );
}

type ApprovalWithDocs = NonNullable<
  Awaited<
    ReturnType<
      typeof db.approval.findUnique<{
        where: { id: string };
        include: {
          documents: { include: { submittal: true } };
          permit: { include: { project: true } };
        };
      }>
    >
  >
>;

/** The documents that make up the submission package. */
function PackageList({
  approval,
  editable,
}: {
  approval: ApprovalWithDocs;
  editable: boolean;
}) {
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {approval.documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm">{doc.name}</div>
            {doc.submittal?.status === "uploaded" && doc.filePath ? (
              <a
                href={`/api/files/${doc.filePath}`}
                target="_blank"
                className="text-xs text-blue-600 hover:underline"
              >
                View file
                {doc.uploadedAt ? ` · added ${longDate(doc.uploadedAt)}` : ""}
              </a>
            ) : (
              <div className="text-xs text-gray-400">Not uploaded</div>
            )}
          </div>
          {doc.submittal?.status === "uploaded" ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Ready
            </span>
          ) : editable ? (
            <UploadButton uploadUrl={`/api/documents/${doc.id}/upload`} label="Upload" />
          ) : (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              Missing
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Preparing({ approval }: { approval: ApprovalWithDocs }) {
  const total = approval.documents.length;
  const ready = approval.documents.filter((d) => d.submittal?.status === "uploaded").length;
  const outstanding = total - ready;

  return (
    <section>
      <SectionHeader title="Initial submittal" />
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-base font-semibold">To submit</h3>
        <span className="text-sm text-gray-500">
          {ready} of {total} documents ready
        </span>
      </div>

      <PackageList approval={approval} editable />

      <p className="mt-3 text-sm text-gray-500">
        {outstanding === 0
          ? `Everything is ready. Submit the package to ${approval.permit.project.ahjName}.`
          : `${outstanding} document${outstanding === 1 ? "" : "s"} still outstanding before this is ready to submit.`}
      </p>
    </section>
  );
}

function Submitted({ approval }: { approval: ApprovalWithDocs }) {
  const ahj = approval.permit.project.ahjName;
  return (
    <section>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="font-medium text-blue-900">
          Submitted to {ahj}. Under review.
        </p>
        {approval.submittedAt && (
          <p className="mt-1 text-sm text-blue-700">
            Sent {longDate(approval.submittedAt)} · day{" "}
            {daysSince(approval.submittedAt)} of review
          </p>
        )}
      </div>

      <div className="mt-10">
        <ReviewCycles approval={approval} />
      </div>
    </section>
  );
}

function Comments({ approval }: { approval: ApprovalWithDocs }) {
  return <ReviewCycles approval={approval} />;
}

function Approved({ approval }: { approval: ApprovalWithDocs }) {
  return (
    <section>
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-900">
          Approved by {approval.permit.project.ahjName}.
        </p>
        {approval.approvedAt && (
          <p className="mt-1 text-sm text-green-700">
            {longDate(approval.approvedAt)}
          </p>
        )}
      </div>

      <div className="mt-10">
        <ReviewCycles approval={approval} />
      </div>
    </section>
  );
}

const loadLetters = (approvalId: string) =>
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

type Letter = Awaited<ReturnType<typeof loadLetters>>[number];

const loadSubmissions = (approvalId: string) =>
  db.submission.findMany({
    where: { approvalId },
    orderBy: { number: "desc" },
    include: { documents: { include: { document: true } } },
  });

/**
 * The approval's history with the jurisdiction, newest first. It starts with
 * the initial submittal; review cycle N is then the jurisdiction's Nth set of
 * comments together with the resubmittal answering them (submission N + 1).
 * Cycles are numbered the way the jurisdiction's letters number their reviews.
 */
async function ReviewCycles({ approval }: { approval: ApprovalWithDocs }) {
  const [submissions, letters, memberships] = await Promise.all([
    loadSubmissions(approval.id),
    loadLetters(approval.id),
    db.projectMember.findMany({
      where: { projectId: approval.permit.projectId },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  const letterForRound = new Map(letters.map((letter) => [letter.round, letter]));

  // The project team, who comments can be assigned to.
  const members = memberships.map(({ user }) => ({ id: user.id, name: user.name, role: user.role }));

  // Uploaded package files, which responses can reference.
  const files = await Promise.all(
    approval.documents
      .filter(
        (d) =>
          d.submittal?.status === "uploaded" &&
          d.submittal.kind !== "response_letter" &&
          d.filePath
      )
      .map(async (d) => ({
        id: d.id,
        name: d.name,
        meta: fileMeta(d.filePath!, await uploadSize(d.filePath!)),
      }))
  );

  // While the team answers comments, the review cycle they belong to is on top,
  // not submitted yet: the response letter, the files attached so far, and the
  // comments. Submitting sends exactly those files (see recordSubmission).
  const preparing = approval.status === "comments";
  const latestNumber = submissions[0]?.number ?? 0;
  const openLetter = preparing ? letterForRound.get(latestNumber) : undefined;
  const attached = new Set(
    openLetter?.comments.flatMap((c) => c.attachments.map((a) => a.documentId))
  );
  const pending = approval.documents.filter(
    (d) => d.submittal?.status === "uploaded" && !d.submittal.submissionId && attached.has(d.id)
  );

  return (
    <div className="flex flex-col text-ink">
      {preparing && (
        <section>
          <SectionHeader title={`Review cycle ${latestNumber}`} />
          <div className="flex flex-col gap-10">
            <SubmittedFiles
              heading="To submit"
              documents={pending.map((d) => ({ ...d, kind: d.submittal!.kind }))}
              answered={openLetter}
              empty="No files attached yet."
            />
            {openLetter && (
              <LetterComments
                letter={openLetter}
                approvalId={approval.id}
                editable
                files={files}
                members={members}
              />
            )}
          </div>
        </section>
      )}

      {submissions.map((submission, i) => {
        // Submission N + 1 answers review N's comments; submission 1 answers none.
        const answered = letterForRound.get(submission.number - 1);
        return (
          <section
            key={submission.id}
            className={i > 0 || preparing ? "mt-12 border-t border-line pt-10" : ""}
          >
            <SectionHeader
              title={
                submission.number === 1
                  ? "Initial submittal"
                  : `Review cycle ${submission.number - 1}`
              }
              submittedAt={submission.submittedAt}
            />

            <div className="flex flex-col gap-10">
              <SubmittedFiles
                heading="What we submitted"
                documents={submission.documents.map(({ document, kind }) => ({ ...document, kind }))}
                answered={answered}
                empty="No files were submitted."
              />
              {answered && (
                <LetterComments
                  letter={answered}
                  approvalId={approval.id}
                  editable={false}
                  files={files}
                  members={members}
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** A comment letter and the team's responses to it. */
function LetterComments({
  letter,
  approvalId,
  editable,
  files,
  members,
}: {
  letter: Letter;
  approvalId: string;
  editable: boolean;
  files: LedgerFile[];
  members: Member[];
}) {
  const letterUrl = `/api/files/${letter.document.filePath}`;
  const letterLink = (
    <a
      href={letterUrl}
      target="_blank"
      className="text-accent hover:text-accent-hover"
    >
      {letter.document.name}
    </a>
  );

  const notice =
    letter.parseStatus === "processing" ? (
      <>Reading the comments in {letterLink}. This takes a few seconds.</>
    ) : letter.parseStatus === "failed" ? (
      <>Couldn&apos;t read the comments in {letterLink}.</>
    ) : letter.comments.length === 0 ? (
      <>No comments were found in {letterLink}.</>
    ) : undefined;

  const comments: LedgerComment[] = letter.comments.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    discipline: c.discipline,
    text: c.text,
    sheetRefs: c.sheetRefs,
    codeRefs: c.codeRefs,
    commentType: c.commentType,
    response: c.response ?? "",
    completed: c.completed,
    assigneeIds: c.assignees.map((a) => a.id),
    attachmentIds: c.attachments.map((a) => a.documentId),
  }));

  return (
    <>
      {letter.parseStatus === "processing" && <AutoRefresh />}
      <CommentLedger
        // Remount when parsing finishes so the rows start from the new data.
        key={`${letter.documentId}-${letter.parseStatus}`}
        approvalId={approvalId}
        letterId={letter.documentId}
        editable={editable}
        comments={comments}
        files={files}
        members={members}
        // Comments can be added by hand once parsing has finished, including
        // when it failed or found nothing.
        canAdd={editable && letter.parseStatus !== "processing"}
        notice={notice}
      />
    </>
  );
}

/** "Initial submittal" or "Review cycle N", with when it went out or that it hasn't yet. */
function SectionHeader({ title, submittedAt }: { title: string; submittedAt?: Date }) {
  return (
    <header className="mb-6 flex items-baseline justify-between gap-4 text-ink">
      <h2 className="text-xl font-semibold">{title}</h2>
      <span className="text-sm text-ink-muted">
        {submittedAt ? `Submitted ${longDate(submittedAt)}` : "Not submitted yet"}
      </span>
    </header>
  );
}

/**
 * The files in a submission. A resubmittal holds the response letter to the
 * comments it answers, plus supplementary files.
 */
async function SubmittedFiles({
  heading,
  documents,
  answered,
  empty,
}: {
  heading: string;
  documents: { id: string; name: string; filePath: string | null; kind: DocumentKind }[];
  answered?: Letter;
  empty: string;
}) {
  // Response letters are generated, so they live apart from uploads.
  const describe = async (document: (typeof documents)[number]) => {
    const generated = document.kind === "response_letter";
    const size = generated
      ? await generatedPdfSize(document.filePath!)
      : await uploadSize(document.filePath!);
    return {
      id: document.id,
      name: document.name,
      href: `${generated ? "/api/generated-pdfs" : "/api/files"}/${document.filePath}`,
      meta: `${fileMeta(document.filePath!, size)} · ${uploadedFileName(document.filePath!)}`,
    };
  };
  const withFiles = documents.filter((document) => document.filePath);
  const stored = withFiles.find((document) => document.kind === "response_letter");
  const supplementary = await Promise.all(
    withFiles.filter((document) => document !== stored).map(describe)
  );

  // The response letter: the copy stored when it went out, or else one
  // generated from the saved responses on download (a draft while they can
  // still change).
  const responseFile = stored
    ? await describe(stored)
    : answered && {
        id: `response-${answered.documentId}`,
        name: "Response letter",
        meta: `PDF · generated on download · ${responseLetterFileName(answered.round)}`,
        action: (
          <DownloadButton
            href={`/api/comment-letters/${answered.documentId}/response-letter`}
            fileName={responseLetterFileName(answered.round)}
          />
        ),
      };

  return (
    <section>
      <h3 className="mb-3 text-base font-semibold">{heading}</h3>

      {responseFile && <FileList files={[responseFile]} />}

      {answered && (
        <div className="mt-5 mb-2 font-mono text-caption tracking-label text-ink-muted">
          SUPPLEMENTARY FILES
        </div>
      )}
      {supplementary.length > 0 ? (
        <FileList files={supplementary} />
      ) : (
        <p className="text-sm text-ink-muted">{empty}</p>
      )}
    </section>
  );
}

/** Files as one bordered list, each with a View link or its own `action`. */
function FileList({
  files,
}: {
  files: { id: string; name: string; meta: string; href?: string; action?: ReactNode }[];
}) {
  return (
    <ul className="divide-y divide-line-row rounded-lg border border-line bg-white">
      {files.map((file) => (
        <li key={file.id} className="flex items-center gap-3 px-4 py-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="flex-none text-ink-secondary" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{file.name}</div>
            <div className="text-tiny text-ink-muted">{file.meta}</div>
          </div>
          {file.action ??
            (file.href && (
              <a
                href={file.href}
                target="_blank"
                className="flex-none text-small text-accent hover:text-accent-hover"
              >
                View
              </a>
            ))}
        </li>
      ))}
    </ul>
  );
}
