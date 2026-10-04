"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { errorOf } from "@/lib/requests";

export function UploadButton({
  uploadUrl,
  label,
  ariaLabel,
  accept,
  primary,
}: {
  uploadUrl: string;
  label: string;
  /** Names what's uploaded when the label alone doesn't, e.g. in a list of files. */
  ariaLabel?: string;
  accept?: string;
  primary?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileSelected(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(uploadUrl, { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError((await errorOf(res)) ?? "Upload failed. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex flex-none items-center gap-2">
      {error && (
        <span role="alert" className="text-small text-status-open-ink">
          {error}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        aria-label={ariaLabel}
        className={primary ? PRIMARY_BUTTON : SECONDARY_BUTTON}
      >
        {busy ? "Uploading…" : label}
      </button>
    </span>
  );
}
