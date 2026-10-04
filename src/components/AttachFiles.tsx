"use client";

import { useId, useRef, useState } from "react";
import { ChevronDownIcon, PlusIcon } from "@/components/icons";
import { Popover } from "@/components/Popover";
import { FOCUS_RING, OPTION, SECONDARY_BUTTON } from "@/components/styles";

/** A file in the approval's package, which responses can reference. */
export type LedgerFile = { id: string; name: string; meta: string };

/**
 * Picks the package files a response references, or uploads a new one.
 * `onUpload` resolves to an error message, or null when it worked.
 */
export function AttachFiles({
  files,
  attachedIds,
  onToggle,
  onUpload,
}: {
  files: LedgerFile[];
  attachedIds: string[];
  onToggle: (fileId: string) => void;
  onUpload: (file: File) => Promise<string | null>;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadError(await onUpload(file));
    setUploading(false);
  }

  return (
    <Popover
      label="PROJECT FILES"
      trigger={
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          Attach files
          {attachedIds.length > 0 && (
            <span className="font-mono text-tiny text-ink-muted">({attachedIds.length})</span>
          )}
          <ChevronDownIcon className="text-ink-muted" />
        </>
      }
      triggerClassName={SECONDARY_BUTTON}
      panelClassName="left-0 mt-2 w-95"
    >
      {files.length === 0 && (
        <p className="px-2.5 py-2 text-small text-ink-muted">No files in this package yet.</p>
      )}
      {files.map((file) => (
        <label key={file.id} htmlFor={`${id}-${file.id}`} className={OPTION}>
          <input
            id={`${id}-${file.id}`}
            type="checkbox"
            checked={attachedIds.includes(file.id)}
            onChange={() => onToggle(file.id)}
            className={`size-4 flex-none accent-accent ${FOCUS_RING}`}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-small text-ink">{file.name}</span>
            <span className="text-tiny text-ink-muted">{file.meta}</span>
          </span>
        </label>
      ))}
      <div className="mt-1 border-t border-line-row pt-1">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          className={`${OPTION} text-small text-ink disabled:opacity-50`}
        >
          <PlusIcon size={16} className="flex-none text-ink-muted" />
          {uploading ? "Uploading…" : "Upload new file"}
        </button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
        {uploadError && (
          <p role="alert" className="px-2.5 pb-1.5 text-tiny text-status-open-ink">
            {uploadError}
          </p>
        )}
      </div>
    </Popover>
  );
}

/** An attached file's name, with a button to remove it while it can change. */
export function FileChip({ file, onRemove }: { file: LedgerFile; onRemove?: () => void }) {
  return (
    <span
      className={`inline-flex h-7 max-w-60 items-center gap-1.5 rounded-chip bg-chip pl-2.5 text-meta text-chip-ink ${
        onRemove ? "pr-1" : "pr-2.5"
      }`}
    >
      <span className="truncate">{file.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.name}`}
          className={`inline-flex size-5.5 flex-none cursor-pointer items-center justify-center rounded ${FOCUS_RING}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  );
}
