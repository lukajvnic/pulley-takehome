"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CommentRow,
  ROW_GRID,
  type LedgerComment,
  type QuickField,
} from "@/components/CommentRow";
import type { Member } from "@/components/AssigneePicker";
import type { LedgerFile } from "@/components/AttachFiles";
import { CommentEditor, type CommentFields } from "@/components/CommentEditor";
import { ExternalLink } from "@/components/links";
import { PlusIcon } from "@/components/icons";
import { FOCUS_RING, LABEL } from "@/components/styles";
import { errorOf, patchComment } from "@/lib/requests";
import { plural } from "@/lib/format";

type OwnFields = Pick<
  LedgerComment,
  "number" | "title" | "discipline" | "text" | "commentType" | "sheetRefs" | "codeRefs"
>;

/** The fields a comment's own editor works with, from an API response. */
function commentFieldsOf(saved: OwnFields): OwnFields {
  const { number, title, discipline, text, commentType, sheetRefs, codeRefs } = saved;
  return { number, title, discipline, text, commentType, sheetRefs, codeRefs };
}

/**
 * The comments from a letter, one expandable row each, where the team writes
 * its responses. `notice` stands in for the rows while there are none (the
 * letter is being parsed, or nothing came out of it). While `canAdd`, the team
 * can also add comments the parser missed, and edit or delete any.
 */
export function CommentLedger({
  approvalId,
  letterId,
  editable,
  comments,
  files,
  members,
  canAdd,
  notice,
}: {
  approvalId: string;
  letterId: string;
  editable: boolean;
  comments: LedgerComment[];
  files: LedgerFile[];
  members: Member[];
  canAdd: boolean;
  notice?: ReactNode;
}) {
  // Refreshing after an upload re-renders the server parts of the page (the new
  // file in "To submit" and the file list) while keeping this component's state.
  const router = useRouter();
  const [rows, setRows] = useState(comments);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const setRow = (commentId: string, change: Partial<LedgerComment>) =>
    setRows((current) =>
      current.map((row) => (row.id === commentId ? { ...row, ...change } : row))
    );

  /** Shows the change right away and saves it, putting it back if saving fails. */
  async function update<K extends QuickField>(commentId: string, key: K, value: LedgerComment[K]) {
    const before = rows.find((row) => row.id === commentId)?.[key];
    setRow(commentId, { [key]: value });
    const res = await patchComment(commentId, { [key]: value });
    if (!res?.ok) {
      // Unless a newer change has replaced it in the meantime.
      setRows((current) =>
        current.map((row) =>
          row.id === commentId && row[key] === value ? { ...row, [key]: before } : row
        )
      );
    }
  }

  /** Saves a comment's own fields; resolves to an error message or null. */
  async function editComment(commentId: string, fields: CommentFields) {
    const res = await patchComment(commentId, fields);
    if (!res?.ok) return (await errorOf(res)) ?? "Couldn't save the comment.";
    setRow(commentId, commentFieldsOf(await res.json()));
    return null;
  }

  async function deleteComment(commentId: string) {
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return (await errorOf(res)) ?? "Couldn't delete the comment.";
    setRows((current) => current.filter((row) => row.id !== commentId));
    return null;
  }

  async function addComment(fields: CommentFields) {
    const res = await fetch(`/api/comment-letters/${letterId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(() => null);
    if (!res?.ok) return (await errorOf(res)) ?? "Couldn't add the comment.";
    const saved = await res.json();
    setRows((current) => [
      ...current,
      {
        id: saved.id,
        ...commentFieldsOf(saved),
        response: "",
        completed: false,
        assigneeIds: [],
        attachmentIds: [],
      },
    ]);
    setOpen((current) => ({ ...current, [saved.id]: true }));
    setAdding(false);
    return null;
  }

  /** Adds a file to the package and attaches it to the comment; it lists once the page refreshes. */
  async function uploadFile(commentId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    body.append("commentId", commentId);
    const res = await fetch(`/api/approvals/${approvalId}/documents`, {
      method: "POST",
      body,
    }).catch(() => null);
    if (!res?.ok) return (await errorOf(res)) ?? "Upload failed. Please try again.";

    const document: { id: string } = await res.json();
    setRows((current) =>
      current.map((row) =>
        row.id === commentId ? { ...row, attachmentIds: [...row.attachmentIds, document.id] } : row
      )
    );
    router.refresh();
    return null;
  }

  const total = plural(rows.length, "comment");
  const summary = editable
    ? `${total} · ${rows.filter((c) => c.commentType === "correction" && !c.completed).length} awaiting response`
    : `${total} · ${rows.filter((c) => c.completed).length} completed`;

  // A new comment most likely follows the last one: next number, same discipline.
  const last = rows.at(-1);
  const blank: CommentFields = {
    number: last && /^\d+$/.test(last.number) ? String(Number(last.number) + 1) : "",
    title: "",
    discipline: last?.discipline ?? "",
    text: "",
    commentType: "correction",
    sheetRefs: [],
    codeRefs: [],
  };

  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between gap-6">
        <h3 className="flex items-baseline gap-1.75 text-base font-semibold">
          Plan review comments
          <span className="font-normal text-ink-muted">·</span>
          <ExternalLink href={`/letters/${letterId}`} className="font-medium">
            PDF
          </ExternalLink>
        </h3>
        {rows.length > 0 && <div className="text-small text-ink-muted">{summary}</div>}
      </header>

      <div className="rounded-lg border border-line bg-white">
        <div
          className={`${ROW_GRID} border-b border-line-header py-2.5 font-mono text-caption tracking-caption text-ink-muted`}
        >
          <span />
          <span>NO.</span>
          <span>COMMENT</span>
          <span className="text-center">ASSIGNED</span>
          <span className="text-center">STATUS</span>
        </div>

        {rows.length === 0 && notice && (
          <p className="px-5 py-5 text-sm text-ink-secondary">{notice}</p>
        )}
        {rows.map((comment, i) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            files={files}
            members={members}
            editable={editable}
            open={!!open[comment.id]}
            onToggle={() => setOpen((current) => ({ ...current, [comment.id]: !current[comment.id] }))}
            onUpdate={(key, value) => update(comment.id, key, value)}
            onEditComment={(fields) => editComment(comment.id, fields)}
            onDeleteComment={() => deleteComment(comment.id)}
            onUploadFile={(file) => uploadFile(comment.id, file)}
            letterHref={`/letters/${letterId}?comment=${comment.id}`}
            isFirst={i === 0}
            isLast={i === rows.length - 1 && !canAdd}
          />
        ))}

        {canAdd &&
          (adding ? (
            <div className="rounded-b-lg border-t border-line-row bg-row-open pt-4 pr-5 pb-6 pl-27">
              <div className={`mb-3 ${LABEL}`}>NEW COMMENT</div>
              <CommentEditor
                initial={blank}
                saveLabel="Add comment"
                onSave={addComment}
                onCancel={() => setAdding(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-b-lg border-t border-line-row py-3 pr-5 pl-27 text-left text-small font-medium text-accent hover:bg-row-hover ${FOCUS_RING}`}
            >
              <PlusIcon />
              Add a comment the parser missed
            </button>
          ))}
      </div>
    </section>
  );
}
