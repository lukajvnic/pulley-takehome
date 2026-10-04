"use client";

import { useState, type ReactNode } from "react";
import {
  CommentRow,
  ROW_GRID,
  type LedgerComment,
  type LedgerFile,
  type Member,
  type RowMenu,
} from "@/components/CommentRow";
import { fileMeta } from "@/lib/format";

/**
 * The comments from a letter, one expandable row each, where the team writes
 * its responses. `notice` replaces the rows while the letter is being parsed,
 * or when there is nothing to show.
 */
export function CommentLedger({
  approvalId,
  caption,
  editable,
  comments,
  files: initialFiles,
  letterUrl,
  members,
  notice,
}: {
  approvalId: string;
  caption: string;
  editable: boolean;
  comments: LedgerComment[];
  files: LedgerFile[];
  letterUrl: string;
  members: Member[];
  notice?: ReactNode;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<{ commentId: string; kind: RowMenu } | null>(null);
  const [assignees, setAssignees] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(comments.map((c) => [c.id, c.assigneeIds]))
  );
  // Once submitted, the list starts collapsed to keep the page short.
  const [listOpen, setListOpen] = useState(editable);
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
    return true;
  }

  const total = `${comments.length} comment${comments.length === 1 ? "" : "s"}`;
  const summary = editable
    ? `${total} · ${comments.filter((c) => c.commentType === "correction" && !completed[c.id]).length} awaiting response`
    : `${total} · ${comments.filter((c) => completed[c.id]).length} completed`;

  return (
    <section className="text-ink">
      <header className={`flex items-end justify-between gap-6 ${listOpen ? "mb-5" : ""}`}>
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-xs tracking-caption text-ink-muted uppercase">{caption}</div>
          <h2 className="text-2xl font-semibold">Plan review comments</h2>
        </div>
        {!notice && (
          <div className="flex items-center gap-4 text-small text-ink-muted">
            {summary}
            {!editable && (
              <button
                type="button"
                onClick={() => setListOpen((current) => !current)}
                aria-expanded={listOpen}
                className="inline-flex cursor-pointer items-center gap-1 font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {listOpen ? "Hide comments" : "Show comments"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-150 ${listOpen ? "rotate-180" : ""}`} aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </header>

      {(listOpen || notice) && (
        <div className={`rounded-lg border border-line bg-white ${listOpen ? "" : "mt-5"}`}>
          <div
            className={`${ROW_GRID} border-b border-line-header py-2.5 font-mono text-caption tracking-caption text-ink-muted`}
          >
            <span />
            <span>NO.</span>
            <span>COMMENT</span>
            <span className="text-center">ASSIGNED</span>
            <span className="text-center">STATUS</span>
          </div>

          {notice ? (
            <p className="px-5 py-5 text-sm text-ink-secondary">{notice}</p>
          ) : (
            comments.map((comment, i) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                response={responses[comment.id] ?? ""}
                onResponseChange={(value) =>
                  setResponses((current) => ({ ...current, [comment.id]: value }))
                }
                completed={!!completed[comment.id]}
                onToggleCompleted={() => toggleCompleted(comment.id)}
                files={files}
                attachedIds={attachments[comment.id] ?? []}
                onToggleFile={(fileId) => toggleFile(comment.id, fileId)}
                onUploadFile={(file) => uploadFile(comment.id, file)}
                letterUrl={letterUrl}
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
                isLast={i === comments.length - 1}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
