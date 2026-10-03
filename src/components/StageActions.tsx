"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ApprovalStatus } from "@prisma/client";
import { UploadButton } from "@/components/UploadButton";

type Action = {
  label: string;
  next: ApprovalStatus;
  primary?: boolean;
  // Move by uploading the comment letter, which also changes the status.
  uploadLetter?: boolean;
};

// Forward moves only. The API itself allows any status to any status.
const actions: Record<ApprovalStatus, Action[]> = {
  preparing: [{ label: "Submit to jurisdiction", next: "submitted", primary: true }],
  submitted: [
    { label: "Comments received", next: "comments", primary: true, uploadLetter: true },
    { label: "Mark approved", next: "approved" },
  ],
  comments: [
    { label: "Submit response", next: "submitted", primary: true },
    { label: "Mark approved", next: "approved" },
  ],
  approved: [],
};

export function StageActions({
  approvalId,
  status,
}: {
  approvalId: string;
  status: ApprovalStatus;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ApprovalStatus | null>(null);

  async function move(next: ApprovalStatus) {
    setPending(next);
    await fetch(`/api/approvals/${approvalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setPending(null);
    router.refresh();
  }

  const available = actions[status];
  if (available.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
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
            type="button"
            disabled={pending !== null}
            onClick={() => move(action.next)}
            className={
              action.primary
                ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
                : "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            }
          >
            {pending === action.next ? "Saving…" : action.label}
          </button>
        )
      )}
    </div>
  );
}
