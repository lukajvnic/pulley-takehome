"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LINK } from "@/components/styles";
import { errorOf } from "@/lib/requests";

/** Takes a file out of the package before it's submitted. */
export function RemoveFileButton({ documentId, name }: { documentId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" }).catch(
      () => null
    );
    if (!res?.ok) {
      setError((await errorOf(res)) ?? "Couldn't remove");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex flex-none items-center gap-3">
      {error && (
        <span role="alert" className="text-tiny text-status-open-ink">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={`Remove ${name}`}
        className={`cursor-pointer text-small ${LINK} disabled:cursor-default disabled:text-ink-muted`}
      >
        {busy ? "Removing…" : "Remove"}
      </button>
    </span>
  );
}
