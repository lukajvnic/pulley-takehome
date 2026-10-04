"use client";

import { useState } from "react";
import { flushPendingSaves } from "@/lib/pending-saves";
import { LINK } from "@/components/styles";

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
      {failed && (
        <span role="alert" className="text-tiny text-status-open-ink">
          Couldn&apos;t generate
        </span>
      )}
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={`cursor-pointer text-small ${LINK} disabled:cursor-default disabled:text-ink-muted`}
      >
        {busy ? "Generating…" : "Download"}
      </button>
    </span>
  );
}
