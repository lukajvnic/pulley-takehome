"use client";

import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalStatus } from "@prisma/client";
import { SpinnerIcon, UndoIcon } from "@/components/icons";
import { UploadButton } from "@/components/UploadButton";
import { PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { flushPendingSaves } from "@/lib/pending-saves";
import { errorOf } from "@/lib/requests";
import { useDismiss } from "@/lib/use-dismiss";

type Action = {
  label: string;
  next: ApprovalStatus;
  primary?: boolean;
  // Move by uploading the comment letter, which also changes the status.
  uploadLetter?: boolean;
};

// Forward moves only. The API itself allows any status to any status.
// Submitting and receiving comments repeat, one review cycle per submission,
// until the jurisdiction approves.
const actions: Record<ApprovalStatus, Action[]> = {
  preparing: [{ label: "Submit to jurisdiction", next: "submitted", primary: true }],
  submitted: [
    { label: "Comments received", next: "comments", primary: true, uploadLetter: true },
    { label: "Mark approved", next: "approved" },
  ],
  comments: [{ label: "Submit to jurisdiction", next: "submitted", primary: true }],
  approved: [],
};

// What Undo takes back from each status (see /api/approvals/:id/undo).
const undoLabels: Record<ApprovalStatus, string | null> = {
  preparing: null,
  submitted: "Undo the submission",
  comments: "Remove the comment letter",
  approved: "Undo the approval",
};

export function StageActions({
  approvalId,
  status,
}: {
  approvalId: string;
  status: ApprovalStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ApprovalStatus | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set when the server holds a submission back over unanswered corrections.
  const [unanswered, setUnanswered] = useState<{ next: ApprovalStatus; count: number } | null>(
    null
  );
  // Removing a comment letter deletes the team's responses, so it asks first.
  const [confirmUndo, setConfirmUndo] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  useDismiss(!!unanswered, area, submitButton, () => setUnanswered(null));
  useDismiss(confirmUndo, area, undoButton, () => setConfirmUndo(false));

  async function move(next: ApprovalStatus, confirmUnanswered = false) {
    setPending(next);
    setError(null);
    // The response letter is rendered from what's saved, so finish saving first.
    await flushPendingSaves();
    const res = await fetch(`/api/approvals/${approvalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, confirmUnanswered }),
    }).catch(() => null);
    setPending(null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      if (body?.unanswered) {
        setUnanswered({ next, count: body.unanswered });
      } else {
        setUnanswered(null);
        setError(body?.error ?? "Couldn't update the status. Please try again.");
      }
      return;
    }
    setUnanswered(null);
    router.refresh();
  }

  async function undo() {
    setPending("undo");
    setError(null);
    const res = await fetch(`/api/approvals/${approvalId}/undo`, { method: "POST" }).catch(
      () => null
    );
    setPending(null);
    setConfirmUndo(false);
    if (!res?.ok) {
      setError((await errorOf(res)) ?? "Couldn't undo. Please try again.");
      return;
    }
    router.refresh();
  }

  const available = actions[status];
  const undoLabel = undoLabels[status];
  if (available.length === 0 && !undoLabel) return null;

  return (
    <div ref={area} className="relative flex items-center gap-2">
      {error && (
        <span role="alert" className="text-small text-status-open-ink">
          {error}
        </span>
      )}
      {undoLabel && (
        <button
          ref={undoButton}
          type="button"
          disabled={pending !== null}
          onClick={() => {
            setUnanswered(null);
            if (status === "comments") setConfirmUndo(true);
            else undo();
          }}
          aria-label={undoLabel}
          title={undoLabel}
          aria-expanded={status === "comments" ? confirmUndo : undefined}
          className={QUIET_BUTTON}
        >
          {pending === "undo" ? <SpinnerIcon size={16} /> : <UndoIcon />}
        </button>
      )}
      {available.map((action) =>
        action.uploadLetter ? (
          <UploadButton
            key={action.next}
            uploadUrl={`/api/approvals/${approvalId}/comment-letters`}
            label={action.label}
            accept="application/pdf"
            primary={action.primary}
          />
        ) : (
          <button
            key={action.next}
            ref={action.primary ? submitButton : undefined}
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setConfirmUndo(false);
              move(action.next);
            }}
            aria-expanded={action.primary && unanswered ? true : undefined}
            className={action.primary ? PRIMARY_BUTTON : SECONDARY_BUTTON}
          >
            {pending === action.next ? "Saving…" : action.label}
          </button>
        )
      )}

      {unanswered && (
        <ConfirmDialog
          id="unanswered"
          title={
            unanswered.count === 1
              ? "1 correction still needs a response"
              : `${unanswered.count} corrections still need a response`
          }
          cancelLabel="Keep working"
          confirmLabel={pending ? "Submitting…" : "Submit anyway"}
          busy={pending !== null}
          onCancel={() => setUnanswered(null)}
          onConfirm={() => move(unanswered.next, true)}
        >
          Corrections that aren&apos;t marked completed go out as they are. Any without a written
          response read &ldquo;No response provided.&rdquo; in the letter.
        </ConfirmDialog>
      )}

      {confirmUndo && (
        <ConfirmDialog
          id="undo"
          title="Remove the comment letter?"
          cancelLabel="Keep it"
          confirmLabel={pending ? "Removing…" : "Remove letter"}
          busy={pending !== null}
          onCancel={() => setConfirmUndo(false)}
          onConfirm={undo}
        >
          Its comments and any responses written so far are deleted, and the approval goes back to
          Submitted.
        </ConfirmDialog>
      )}
    </div>
  );
}

/** Asks to confirm an action, in a popover under the buttons. */
function ConfirmDialog({
  id,
  title,
  cancelLabel,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
  children,
}: {
  id: string;
  title: string;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      className="absolute top-full right-0 z-40 mt-2 w-80 rounded-lg border border-line-strong bg-white p-4 shadow-popover"
    >
      <p id={`${id}-title`} className="text-sm font-semibold">
        {title}
      </p>
      <p id={`${id}-body`} className="mt-1 text-small text-ink-secondary">
        {children}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" autoFocus onClick={onCancel} className={SECONDARY_BUTTON}>
          {cancelLabel}
        </button>
        <button type="button" disabled={busy} onClick={onConfirm} className={PRIMARY_BUTTON}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
