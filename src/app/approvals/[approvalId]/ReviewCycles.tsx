import type { DocumentKind } from "@prisma/client";
import { AutoRefresh } from "@/components/AutoRefresh";
import { CommentLedger } from "@/components/CommentLedger";
import type { LedgerComment } from "@/components/CommentRow";
import type { Member } from "@/components/AssigneePicker";
import type { LedgerFile } from "@/components/AttachFiles";
import { DownloadButton } from "@/components/DownloadButton";
import { FileList, type ListedFile } from "@/components/FileList";
import { SpinnerIcon } from "@/components/icons";
import { RemoveFileButton } from "@/components/RemoveFileButton";
import { UploadButton } from "@/components/UploadButton";
import { LABEL, LINK } from "@/components/styles";
import { longDate, responseLetterFileName } from "@/lib/format";
import {
  describeFile,
  hasFile,
  loadLetters,
  loadMembers,
  loadSubmissions,
  type ApprovalWithDocs,
  type Letter,
} from "./data";

/**
 * The approval's history with the jurisdiction, newest first. It starts with
 * the initial submittal; review cycle N is then the jurisdiction's Nth set of
 * comments together with the resubmittal answering them (submission N + 1).
 * Cycles are numbered the way the jurisdiction's letters number their reviews.
 */
export async function ReviewCycles({ approval }: { approval: ApprovalWithDocs }) {
  const [submissions, letters, members] = await Promise.all([
    loadSubmissions(approval.id),
    loadLetters(approval.id),
    loadMembers(approval.permit.projectId),
  ]);
  const letterForRound = new Map(letters.map((letter) => [letter.round, letter]));

  // Uploaded package files, which responses can reference.
  const files = await Promise.all(
    approval.documents
      .filter((d) => d.submittal?.status === "uploaded" && d.submittal.kind === "required_upload")
      .filter(hasFile)
      .map((d) => describeFile({ ...d, kind: "required_upload" }))
  );

  // While the team answers comments, the review cycle they belong to is on top,
  // not submitted yet: the response letter, the files added so far, and the
  // comments. Submitting sends exactly those files (see recordSubmission).
  const responding = approval.status === "comments";
  const latestNumber = submissions[0]?.number ?? 0;
  const openLetter = responding ? letterForRound.get(latestNumber) : undefined;
  const pending = approval.documents.filter(
    (d) =>
      d.submittal?.status === "uploaded" &&
      d.submittal.kind === "required_upload" &&
      !d.submittal.submissionId
  );

  return (
    <div className="flex flex-col">
      {responding && (
        <section>
          <SectionHeader title={`Review cycle ${latestNumber}`} />
          <div className="flex flex-col gap-10">
            <SubmittedFiles
              heading="To submit"
              documents={pending.map((d) => ({ ...d, kind: d.submittal!.kind }))}
              answered={openLetter}
              empty="No files added yet."
              addTo={approval.id}
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
            className={i > 0 || responding ? "mt-12 border-t border-line pt-10" : ""}
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

/** "Initial submittal" or "Review cycle N", with when it went out or that it hasn't yet. */
export function SectionHeader({ title, submittedAt }: { title: string; submittedAt?: Date }) {
  return (
    <header className="mb-6 flex items-baseline justify-between gap-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <span className="text-sm text-ink-muted">
        {submittedAt ? `Submitted ${longDate(submittedAt)}` : "Not submitted yet"}
      </span>
    </header>
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
  const letterLink = (
    <a href={`/api/files/${letter.document.filePath}`} target="_blank" className={LINK}>
      {letter.document.name}
    </a>
  );

  const notice =
    letter.parseStatus === "processing" ? (
      <span className="flex items-center gap-2.5">
        <SpinnerIcon className="flex-none text-ink-muted" />
        <span>Reading the comments in {letterLink}. This takes a few seconds.</span>
      </span>
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

/**
 * The files in a submission. A resubmittal holds the response letter to the
 * comments it answers, plus supplementary files. Until it's sent (`addTo` is
 * the approval), files can be added on their own and removed.
 */
async function SubmittedFiles({
  heading,
  documents,
  answered,
  empty,
  addTo,
}: {
  heading: string;
  documents: { id: string; name: string; filePath: string | null; kind: DocumentKind }[];
  answered?: Letter;
  empty: string;
  addTo?: string;
}) {
  const withFiles = documents.filter(hasFile);
  const stored = withFiles.find((document) => document.kind === "response_letter");
  const supplementary = await Promise.all(
    withFiles
      .filter((document) => document !== stored)
      .map(async (document) => ({
        ...(await describeFile(document)),
        action: addTo && <RemoveFileButton documentId={document.id} name={document.name} />,
      }))
  );

  // The response letter: the copy stored when it went out, or else one
  // generated from the saved responses on download (a draft while they can
  // still change).
  const responseFile: ListedFile | undefined = stored
    ? await describeFile(stored)
    : answered && {
        id: `response-${answered.documentId}`,
        name: "Response letter",
        meta: "PDF · generated on download",
        fileName: responseLetterFileName(answered.round),
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

      {answered && <div className={`mt-5 mb-2 ${LABEL}`}>SUPPLEMENTARY FILES</div>}
      {supplementary.length > 0 ? (
        <FileList files={supplementary} />
      ) : (
        <p className="text-sm text-ink-muted">{empty}</p>
      )}
      {addTo && (
        <div className="mt-3">
          <UploadButton uploadUrl={`/api/approvals/${addTo}/documents`} label="Add file" />
        </div>
      )}
    </section>
  );
}
