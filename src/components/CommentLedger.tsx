"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CommentRow,
  ROW_GRID,
  type LedgerComment,
  type LedgerFile,
  type Member,
  type RowMenu,
} from "@/components/CommentRow";
import { CommentEditor, type CommentFields } from "@/components/CommentEditor";
import { FOCUS_RING, LABEL } from "@/components/ledger-styles";
import { fileMeta } from "@/lib/format";

/** The fields a comment's own editor works with, from an API response. */
function commentFieldsOf(saved: {
  number: string;
  title: string | null;
  discipline: string | null;
  text: string;
  commentType: LedgerComment["commentType"];
  sheetRefs: string[];
  codeRefs: string[];
}) {
  const { number, title, discipline, text, commentType, sheetRefs, codeRefs } = saved;
  return { number, title, discipline, text, commentType, sheetRefs, codeRefs };
}

/** The API's error message, if the response carried one. */
async function errorOf(res: Response | null): Promise<string | null> {
  const body = await res?.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : null;
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
  files: initialFiles,
  letterUrl,
  members,
  canAdd,
  notice,
}: {
  approvalId: string;
  letterId: string;
  editable: boolean;
  comments: LedgerComment[];
  files: LedgerFile[];
  letterUrl: string;
  members: Member[];
  canAdd: boolean;
  notice?: ReactNode;
}) {
  // Refreshing re-renders the server parts of the page (like "To submit")
  // while keeping this component's state.
  const router = useRouter();
  const [rows, setRows] = useState(comments);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<{ commentId: string; kind: RowMenu } | null>(null);
  const [assignees, setAssignees] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(comments.map((c) => [c.id, c.assigneeIds]))
  );
  const [responses, setResponses] = useState<Record<string, string>>(() =>
    Object.fromEntries(comments.map((c) => [c.id, c.response]))
  );
  const [attachments, setAttachments] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(comments.map((c) => [c.id, c.attachmentIds]))
  );
  const [completed, setCompleted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(comments.map((c) => [c.id, c.completed]))
  );
  const [files, setFiles] = useState(initialFiles);

  async function toggleCompleted(commentId: string) {
    const next = !completed[commentId];
    setCompleted((current) => ({ ...current, [commentId]: next }));
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    }).catch(() => null);
    if (!res?.ok) setCompleted((current) => ({ ...current, [commentId]: !next }));
  }

  async function toggleAssignee(commentId: string, userId: string) {
    const previous = assignees[commentId] ?? [];
    const next = previous.includes(userId)
      ? previous.filter((id) => id !== userId)
      : [...previous, userId];
    setAssignees((current) => ({ ...current, [commentId]: next }));
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeIds: next }),
    }).catch(() => null);
    if (!res?.ok) setAssignees((current) => ({ ...current, [commentId]: previous }));
  }

  function toggleMenu(commentId: string, kind: RowMenu) {
    setMenu((current) =>
      current?.commentId === commentId && current.kind === kind ? null : { commentId, kind }
    );
  }

  function toggleRow(commentId: string) {
    setOpen((current) => ({ ...current, [commentId]: !current[commentId] }));
    setMenu(null);
  }

  async function toggleFile(commentId: string, fileId: string) {
    const previous = attachments[commentId] ?? [];
    const next = previous.includes(fileId)
      ? previous.filter((id) => id !== fileId)
      : [...previous, fileId];
    setAttachments((current) => ({ ...current, [commentId]: next }));

    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentIds: next }),
    }).catch(() => null);
    if (!res?.ok) setAttachments((current) => ({ ...current, [commentId]: previous }));
    else router.refresh();
  }

  /** Saves a comment's own fields; resolves to an error message or null. */
  async function editComment(commentId: string, fields: CommentFields) {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(() => null);
    if (!res?.ok) return (await errorOf(res)) ?? "Couldn't save the comment.";
    const saved = await res.json();
    setRows((current) =>
      current.map((row) => (row.id === commentId ? { ...row, ...commentFieldsOf(saved) } : row))
    );
    return null;
  }

  async function deleteComment(commentId: string) {
    const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return (await errorOf(res)) ?? "Couldn't delete the comment.";
    setRows((current) => current.filter((row) => row.id !== commentId));
    router.refresh(); // its attachments may drop out of "To submit"
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

  /** Adds a file to the package and attaches it to the comment. */
  async function uploadFile(commentId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    body.append("commentId", commentId);
    const res = await fetch(`/api/approvals/${approvalId}/documents`, {
      method: "POST",
      body,
    }).catch(() => null);
    if (!res?.ok) return false;

    const document: { id: string; name: string } = await res.json();
    setFiles((current) => [
      ...current,
      { id: document.id, name: document.name, meta: fileMeta(file.name, file.size) },
    ]);
    setAttachments((current) => ({
      ...current,
      [commentId]: [...(current[commentId] ?? []), document.id],
    }));
    router.refresh();
    return true;
  }

  const total = `${rows.length} comment${rows.length === 1 ? "" : "s"}`;
  const summary = editable
    ? `${total} · ${rows.filter((c) => c.commentType === "correction" && !completed[c.id]).length} awaiting response`
    : `${total} · ${rows.filter((c) => completed[c.id]).length} completed`;

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
    <section className="text-ink">
      <header className="mb-3 flex items-baseline justify-between gap-6">
        <h3 className="flex items-baseline gap-1.75 text-base font-semibold">
          Plan review comments
          <span className="font-normal text-ink-muted">·</span>
          <a
            href={letterUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-small font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            PDF
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
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
              response={responses[comment.id] ?? ""}
              onResponseChange={(value) =>
                setResponses((current) => ({ ...current, [comment.id]: value }))
              }
              completed={!!completed[comment.id]}
              onToggleCompleted={() => toggleCompleted(comment.id)}
              onEditComment={(fields) => editComment(comment.id, fields)}
              onDeleteComment={() => deleteComment(comment.id)}
              files={files}
              attachedIds={attachments[comment.id] ?? []}
              onToggleFile={(fileId) => toggleFile(comment.id, fileId)}
              onUploadFile={(file) => uploadFile(comment.id, file)}
              assignees={(assignees[comment.id] ?? []).flatMap(
                (userId) => members.find((m) => m.id === userId) ?? []
              )}
              members={members}
              onToggleAssignee={(userId) => toggleAssignee(comment.id, userId)}
              editable={editable}
              open={!!open[comment.id]}
              onToggle={() => toggleRow(comment.id)}
              openMenu={menu?.commentId === comment.id ? menu.kind : null}
              onToggleMenu={(kind) => toggleMenu(comment.id, kind)}
              onCloseMenu={() => setMenu(null)}
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
              onClick={() => {
                setAdding(true);
                setMenu(null);
              }}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-b-lg border-t border-line-row py-3 pr-5 pl-27 text-left text-small font-medium text-accent hover:bg-row-hover ${FOCUS_RING}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add a comment the parser missed
            </button>
          ))}
      </div>
    </section>
  );
}
