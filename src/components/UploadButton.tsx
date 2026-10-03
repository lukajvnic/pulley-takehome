"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadButton({
  uploadUrl,
  label,
  accept,
}: {
  uploadUrl: string;
  label: string;
  accept?: string;
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
    const res = await fetch(uploadUrl, { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      setError("Upload failed. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <span>
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
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Uploading…" : label}
      </button>
      {error && <span className="ml-2 text-sm text-red-600">{error}</span>}
    </span>
  );
}
