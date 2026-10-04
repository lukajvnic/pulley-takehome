"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import type { CommentType } from "@prisma/client";
import { clearPendingSave, trackPendingSave } from "@/lib/pending-saves";
import { patchComment } from "@/lib/requests";
import { displayNumber } from "@/lib/format";
import { FOCUS_RING, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/styles";
import { CheckIcon } from "@/components/icons";
import { ExternalLink } from "@/components/links";
import { AssigneePicker, type Member } from "@/components/AssigneePicker";
import { AttachFiles, FileChip, type LedgerFile } from "@/components/AttachFiles";
import { CommentEditor, type CommentFields } from "@/components/CommentEditor";

export type LedgerComment = {
  id: string;
  number: string;
  title: string | null;
  discipline: string | null;
  text: string;
  sheetRefs: string[];
  codeRefs: string[];
  commentType: CommentType;
  response: string;
  completed: boolean;
  assigneeIds: string[];
  attachmentIds: string[];
};

/** The fields the ledger changes in place: shown right away, then saved. */
export type QuickField = "completed" | "assigneeIds" | "attachmentIds";

/** Columns shared by the header row and each comment row. */
export const ROW_GRID = "grid grid-cols-[20px_44px_minmax(0,1fr)_112px_104px] gap-x-3 px-5";

type Status = "open" | "draft" | "completed" | "info" | "admin";

const STATUS: Record<Status, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-status-open text-status-open-ink" },
  draft: { label: "Draft", className: "bg-status-draft text-status-draft-ink" },
  completed: { label: "Completed", className: "bg-status-completed text-status-completed-ink" },
  info: { label: "Info", className: "bg-canvas text-ink-muted" },
  admin: { label: "Admin", className: "bg-canvas text-ink-muted" },
};

// Disciplines come from the letter as printed, so match on keywords.
const DISCIPLINE_COLORS: [RegExp, string][] = [
  [/struct/i, "bg-discipline-structural"],
  [/fire|life safety/i, "bg-discipline-fire"],
  [/electric/i, "bg-discipline-electrical"],
  [/mechanic/i, "bg-discipline-mechanical"],
  [/plumb/i, "bg-discipline-plumbing"],
  [/access/i, "bg-discipline-accessibility"],
  [/zoning|planning/i, "bg-discipline-zoning"],
];

function statusOf(commentType: CommentType, response: string, completed: boolean): Status {
  if (completed) return "completed";
  if (commentType === "informational") return "info";
  if (commentType === "administrative") return "admin";
  return response.trim() ? "draft" : "open";
}

function disciplineColor(discipline: string) {
  return DISCIPLINE_COLORS.find(([pattern]) => pattern.test(discipline))?.[1] ?? "bg-ink-muted";
}

/** Splits text around the cited references; odd entries are the references. */
function splitRefs(text: string, refs: string[]) {
  const unique = [...new Set(refs.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return [text];
  const escaped = unique.map((ref) => ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.split(new RegExp(`(${escaped.join("|")})`, "g"));
}

/** Copies a sheet or code reference, e.g. to paste into a search or the drawings. */
function RefCopy({ code, children }: { code: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    }, () => {});
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${code}`}
      className={`-mx-2 flex cursor-pointer items-center gap-2.5 rounded-chip px-2 py-1.5 text-left text-ink hover:text-accent ${FOCUS_RING}`}
    >
      {children}
      <span className="font-mono text-meta font-semibold">{code}</span>
      <span aria-live="polite" className="ml-auto inline-flex items-center gap-1 text-tiny font-normal text-saved">
        {copied && (
          <>
            <CheckIcon size={12} />
            Copied
          </>
        )}
      </span>
    </button>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

/** `list` with `item` added, or removed if it was there. */
const toggled = (list: string[], item: string) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export function CommentRow({
  comment,
  files,
  members,
  editable,
  open,
  onToggle,
  onUpdate,
  onEditComment,
  onDeleteComment,
  onUploadFile,
  letterHref,
  isFirst,
  isLast,
}: {
  comment: LedgerComment;
  files: LedgerFile[];
  members: Member[];
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  onUpdate: <K extends QuickField>(key: K, value: LedgerComment[K]) => void;
  onEditComment: (fields: CommentFields) => Promise<string | null>;
  onDeleteComment: () => Promise<string | null>;
  onUploadFile: (file: File) => Promise<string | null>;
  /** The letter viewer, with this comment highlighted. */
  letterHref: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const id = useId();
  const { completed } = comment;
  // The response is typed here, so keystrokes re-render only this row.
  const [response, setResponse] = useState(comment.response);
  const status = STATUS[statusOf(comment.commentType, response, completed)];
  const primarySheet = comment.sheetRefs[0];
  const attached = files.filter((file) => comment.attachmentIds.includes(file.id));
  const toggleFile = (fileId: string) =>
    onUpdate("attachmentIds", toggled(comment.attachmentIds, fileId));
  const [editingComment, setEditingComment] = useState(false);
  // The references panel steps aside while editing, so the form gets the full width.
  const hasRefs =
    !editingComment && (comment.sheetRefs.length > 0 || comment.codeRefs.length > 0);
  // A correction needs a written response before it can be completed.
  const canComplete = completed || comment.commentType !== "correction" || !!response.trim();

  // Responses save on their own: shortly after typing stops, and on blur.
  const [saveState, setSaveState] = useState<SaveState>(response ? "saved" : "idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSave = useRef(0);

  async function save(value: string) {
    saveTimer.current = null;
    const request = ++latestSave.current;
    setSaveState("saving");
    const saving = patchComment(comment.id, { response: value });
    trackPendingSave(comment.id, () => saving.then(() => {}));
    const res = await saving;
    // A newer edit is saving, or waiting to; it reports and untracks itself.
    if (request !== latestSave.current || saveTimer.current) return;
    clearPendingSave(comment.id);
    setSaveState(!res?.ok ? "error" : value.trim() ? "saved" : "idle");
  }

  function changeResponse(value: string) {
    setResponse(value);
    setSaveState("saving"); // unsaved from the first keystroke until the server confirms
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(value), 800);
    // A download can't wait out the debounce, so it saves this value right away.
    trackPendingSave(comment.id, () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      return save(value);
    });
  }

  function flushResponse() {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    save(response);
  }

  return (
    <div
      className={`relative ${isFirst ? "" : "border-t border-line-row"} ${
        open ? "bg-row-open" : "bg-white"
      } ${isLast ? "rounded-b-lg" : ""}`}
    >
      {/* The toggle stretches over the whole row (after:inset-0). The assignee picker
          sits above it, since a popover can't go inside a button. */}
      <div
        className={`${ROW_GRID} relative min-h-15 items-center py-3 hover:bg-row-hover ${
          isLast && !open ? "rounded-b-lg" : ""
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          aria-labelledby={`${id}-number ${id}-title`}
          className={`col-span-2 grid cursor-pointer grid-cols-[20px_44px] items-center gap-x-3 text-left after:absolute after:inset-0 ${FOCUS_RING}`}
        >
          <span className={`inline-flex justify-center transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
          <span id={`${id}-number`} className="font-mono text-meta text-ink-muted">
            {displayNumber(comment.number)}
          </span>
        </button>
        <span className="flex min-w-0 flex-col gap-1 pr-6">
          <span id={`${id}-title`} className="truncate text-body font-semibold">
            {comment.title || comment.text}
          </span>
          {(comment.discipline || primarySheet) && (
            <span className="flex min-w-0 items-center gap-1.75 text-caption font-semibold tracking-label text-ink-secondary uppercase">
              {comment.discipline && (
                <>
                  <span className={`size-2 flex-none rounded-xs ${disciplineColor(comment.discipline)}`} />
                  <span className="truncate">{comment.discipline}</span>
                </>
              )}
              {primarySheet && (
                <span className="flex-none font-mono font-normal tracking-normal text-ink-muted normal-case">
                  {comment.discipline ? `· ${primarySheet}` : primarySheet}
                </span>
              )}
            </span>
          )}
        </span>
        <AssigneePicker
          assigneeIds={comment.assigneeIds}
          members={members}
          editable={editable}
          onToggle={(userId) => onUpdate("assigneeIds", toggled(comment.assigneeIds, userId))}
        />
        <span className="flex justify-center">
          <span className={`inline-flex items-center rounded-full px-2.25 py-0.75 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        </span>
      </div>

      {/* pl-27 (108px) lines the panel up with the title column: px-5 + 20 + 44 + two gaps. */}
      {open && (
        <div
          id={`${id}-panel`}
          className={`grid gap-x-8 gap-y-2 pt-1 pr-5 pb-6 pl-27 ${hasRefs ? "grid-cols-[minmax(0,1fr)_296px]" : ""}`}
        >
          <div className="flex min-w-0 flex-col gap-5.5">
            <section className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className={LABEL}>AHJ COMMENT</div>
                <ExternalLink href={letterHref}>View in letter</ExternalLink>
              </div>
              {editingComment ? (
                <CommentEditor
                  initial={{
                    number: comment.number,
                    title: comment.title ?? "",
                    discipline: comment.discipline ?? "",
                    text: comment.text,
                    commentType: comment.commentType,
                    sheetRefs: comment.sheetRefs,
                    codeRefs: comment.codeRefs,
                  }}
                  saveLabel="Save"
                  onSave={async (fields) => {
                    const failed = await onEditComment(fields);
                    if (!failed) setEditingComment(false);
                    return failed;
                  }}
                  onCancel={() => setEditingComment(false)}
                  onDelete={onDeleteComment}
                />
              ) : (
                <p className="text-body leading-6 whitespace-pre-line text-ink-body">
                  {splitRefs(comment.text, [...comment.sheetRefs, ...comment.codeRefs]).map(
                    (part, i) =>
                      i % 2 ? (
                        <span key={i} className="font-mono text-small font-semibold text-ink">
                          {part}
                        </span>
                      ) : (
                        part
                      )
                  )}
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              {editable ? (
                <>
                  <label htmlFor={`${id}-response`} className={LABEL}>
                    YOUR RESPONSE
                  </label>
                  <textarea
                    id={`${id}-response`}
                    value={response}
                    onChange={(event) => changeResponse(event.target.value)}
                    onBlur={flushResponse}
                    placeholder="Describe how the drawings were revised, citing sheet and detail numbers…"
                    className={`min-h-28 w-full resize-y rounded-md border border-line-strong bg-white px-3.5 py-3 text-sm leading-5.5 text-ink placeholder:text-ink-placeholder ${FOCUS_RING}`}
                  />
                </>
              ) : (
                <>
                  <div className={LABEL}>YOUR RESPONSE</div>
                  <p className="text-sm leading-5.5 whitespace-pre-line text-ink-body">
                    {response || <span className="text-ink-muted">No response.</span>}
                  </p>
                  {attached.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attached.map((file) => (
                        <FileChip key={file.id} file={file} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          {hasRefs && (
            <aside className="flex flex-col gap-4 self-start rounded-md border border-line-panel bg-canvas p-4">
              <div className={LABEL}>REFERENCED IN COMMENT</div>
              {comment.sheetRefs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="mb-0.5 text-xs font-semibold text-ink-secondary">Drawings</div>
                  {comment.sheetRefs.map((ref) => (
                    <RefCopy key={ref} code={ref}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="flex-none text-ink-secondary" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="1.5" />
                        <path d="M3 15h18M14 15v5" />
                      </svg>
                    </RefCopy>
                  ))}
                </div>
              )}
              {comment.codeRefs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="mb-0.5 text-xs font-semibold text-ink-secondary">Codes &amp; standards</div>
                  {comment.codeRefs.map((ref) => (
                    <RefCopy key={ref} code={ref}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="flex-none text-ink-secondary" aria-hidden="true">
                        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
                        <path d="M5 17a3 3 0 0 1 3-3h11" />
                      </svg>
                    </RefCopy>
                  ))}
                </div>
              )}
            </aside>
          )}

          {/* Spans the panel so completing sits at its right edge, under the references. */}
          {editable && (
            <div className="col-span-full flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <AttachFiles
                  files={files}
                  attachedIds={comment.attachmentIds}
                  onToggle={toggleFile}
                  onUpload={onUploadFile}
                />

                {!editingComment && (
                  <button
                    type="button"
                    onClick={() => setEditingComment(true)}
                    className={SECONDARY_BUTTON}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                    </svg>
                    Edit comment
                  </button>
                )}

                {attached.map((file) => (
                  <FileChip key={file.id} file={file} onRemove={() => toggleFile(file.id)} />
                ))}
              </div>

              <div className="flex flex-none items-center gap-3">
                <span aria-live="polite" className="inline-flex h-9 items-center gap-1.5 text-xs whitespace-nowrap text-ink-muted">
                  {saveState === "saved" && (
                    <>
                      <CheckIcon className="text-saved" />
                      {completed ? "Saved" : "Draft saved"}
                    </>
                  )}
                  {saveState === "saving" && (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" className="opacity-25" />
                        <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                      </svg>
                      Saving…
                    </>
                  )}
                  {saveState === "error" && (
                    <span className="text-status-open-ink">Couldn&apos;t save</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onUpdate("completed", !completed)}
                  disabled={!canComplete}
                  title={canComplete ? undefined : "Write a response first"}
                  className={completed ? SECONDARY_BUTTON : PRIMARY_BUTTON}
                >
                  {completed ? "Reopen" : "Mark completed"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
