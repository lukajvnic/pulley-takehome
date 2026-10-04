"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalStatus } from "@prisma/client";
import { UploadButton } from "@/components/UploadButton";
import { flushPendingSaves } from "@/lib/pending-saves";
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

const PRIMARY =
  "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50";
const SECONDARY =
  "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50";

export function StageActions({
  approvalId,
  status,
}: {
  approvalId: string;
  status: ApprovalStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ApprovalStatus | null>(null);
  // Set when the server holds a submission back over unanswered corrections.
  const [unanswered, setUnanswered] = useState<{ next: ApprovalStatus; count: number } | null>(
    null
  );
  const area = useRef<HTMLDivElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  useDismiss(!!unanswered, area, submitButton, () => setUnanswered(null));

  async function move(next: ApprovalStatus, confirmUnanswered = false) {
    setPending(next);
    // The response letter is rendered from what's saved, so finish saving first.
    await flushPendingSaves();
    const res = await fetch(`/api/approvals/${approvalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, confirmUnanswered }),
    });
    setPending(null);
    if (res.status === 409) {
      const body = await res.json().catch(() => null);
      if (body?.unanswered) {
        setUnanswered({ next, count: body.unanswered });
        return;
      }
    }
    setUnanswered(null);
    router.refresh();
  }

  const available = actions[status];
  if (available.length === 0) return null;

  return (
    <div ref={area} className="relative flex items-center gap-2">
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
            onClick={() => move(action.next)}
            aria-expanded={action.primary && unanswered ? true : undefined}
            className={action.primary ? PRIMARY : SECONDARY}
          >
            {pending === action.next ? "Saving…" : action.label}
          </button>
        )
      )}

      {unanswered && (
        <div
          role="alertdialog"
          aria-labelledby="unanswered-title"
          aria-describedby="unanswered-body"
          className="absolute top-full right-0 z-40 mt-2 w-80 rounded-lg border border-line-strong bg-white p-4 text-ink shadow-popover"
        >
          <p id="unanswered-title" className="text-sm font-semibold">
            {unanswered.count === 1
              ? "1 correction still needs a response"
              : `${unanswered.count} corrections still need a response`}
          </p>
          <p id="unanswered-body" className="mt-1 text-small text-ink-secondary">
            Corrections that aren&apos;t marked completed go out as they are. Any without a
            written response read &ldquo;No response provided.&rdquo; in the letter.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setUnanswered(null)} className={SECONDARY}>
              Keep working
            </button>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => move(unanswered.next, true)}
              className={PRIMARY}
            >
              {pending ? "Submitting…" : "Submit anyway"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
