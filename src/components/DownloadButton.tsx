"use client";

import { useState } from "react";
import { flushPendingSaves } from "@/lib/pending-saves";

/**
 * Downloads a file the server generates on request. Saves still in progress
 * finish first, so the file reflects everything typed so far.
 */
export function DownloadButton({ href, fileName }: { href: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    await flushPendingSaves();
    const res = await fetch(href).catch(() => null);
    if (res?.ok) {
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <span className="flex flex-none items-center gap-3">
      {failed && <span className="text-tiny text-status-open-ink">Couldn&apos;t generate</span>}
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="cursor-pointer text-small text-accent hover:text-accent-hover disabled:cursor-default disabled:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {busy ? "Generating…" : "Download"}
      </button>
    </span>
  );
}
