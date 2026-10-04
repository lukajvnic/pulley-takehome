"use client";

import { useId, useState, type FormEvent } from "react";
import type { CommentType } from "@prisma/client";
import { FOCUS_RING, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { ChevronDownIcon } from "@/components/icons";

/** A comment's own fields, as printed on the letter. */
export type CommentFields = {
  number: string;
  title: string;
  discipline: string;
  text: string;
  commentType: CommentType;
  sheetRefs: string[];
  codeRefs: string[];
};

const TYPES: { value: CommentType; label: string }[] = [
  { value: "correction", label: "Correction" },
  { value: "informational", label: "Informational" },
  { value: "administrative", label: "Administrative" },
];

/** "A-101, S-201" → ["A-101", "S-201"], without blanks or repeats. */
const splitList = (value: string) => [
  ...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  ),
];

const TEXT_BUTTON = `cursor-pointer rounded-xs hover:underline disabled:opacity-50 ${FOCUS_RING}`;

/**
 * Edits a comment the parser got wrong, or adds one it missed. `onSave` and
 * `onDelete` resolve to an error message, or null when they worked.
 */
export function CommentEditor({
  initial,
  saveLabel,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: CommentFields;
  saveLabel: string;
  onSave: (fields: CommentFields) => Promise<string | null>;
  onCancel: () => void;
  onDelete?: () => Promise<string | null>;
}) {
  const id = useId();
  const [values, setValues] = useState({
    ...initial,
    sheetRefs: initial.sheetRefs.join(", "),
    codeRefs: initial.codeRefs.join(", "),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!values.text.trim()) {
      setError("Add the comment's text.");
      return;
    }
    setBusy(true);
    setError(null);
    const failed = await onSave({
      ...values,
      sheetRefs: splitList(values.sheetRefs),
      codeRefs: splitList(values.codeRefs),
    });
    setBusy(false);
    if (failed) setError(failed);
  }

  async function remove() {
    if (!onDelete) return;
    setBusy(true);
    setError(null);
    const failed = await onDelete();
    setBusy(false);
    if (failed) setError(failed);
  }

  const field = (key: keyof typeof values, label: string, placeholder = "") => (
    <label htmlFor={`${id}-${key}`} className="flex min-w-0 flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      <input
        id={`${id}-${key}`}
        value={values[key]}
        onChange={(event) => set(key)(event.target.value)}
        placeholder={placeholder}
        className={INPUT}
      />
    </label>
  );

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-[88px_minmax(0,1fr)_168px] gap-3">
        {field("number", "NO.", "4")}
        {field("discipline", "DISCIPLINE", "Structural")}
        <label htmlFor={`${id}-type`} className="flex flex-col gap-1.5">
          <span className={LABEL}>TYPE</span>
          {/* The native arrow hugs the edge, so it's replaced with the ledger's chevron. */}
          <span className="relative">
            <select
              id={`${id}-type`}
              value={values.commentType}
              onChange={(event) => set("commentType")(event.target.value)}
              className={`${INPUT} h-9.5 cursor-pointer appearance-none pr-9`}
            >
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted" />
          </span>
        </label>
      </div>

      {field("title", "TITLE", "Short summary of what it asks for")}

      <label htmlFor={`${id}-text`} className="flex flex-col gap-1.5">
        <span className={LABEL}>COMMENT</span>
        <textarea
          id={`${id}-text`}
          value={values.text}
          onChange={(event) => set("text")(event.target.value)}
          placeholder="The comment as written in the letter"
          className={`${INPUT} min-h-28 resize-y leading-5.5`}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        {field("sheetRefs", "SHEETS", "A-101, S-201")}
        {field("codeRefs", "CODES & STANDARDS", "CBC 1010.1.1")}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-small">
          {onDelete &&
            (confirmingDelete ? (
              <>
                <span className="text-ink-secondary">Delete this comment and its response?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={remove}
                  className={`${TEXT_BUTTON} font-medium text-status-open-ink`}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className={`${TEXT_BUTTON} text-ink-secondary`}
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className={`${TEXT_BUTTON} text-status-open-ink`}
              >
                Delete comment
              </button>
            ))}
          {error && (
            <span role="alert" className="text-status-open-ink">
              {error}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
