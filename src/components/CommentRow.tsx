"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import type { CommentType } from "@prisma/client";

export type LedgerComment = {
  id: string;
  number: string;
  title: string;
  discipline: string | null;
  text: string;
  sheetRefs: string[];
  codeRefs: string[];
  commentType: CommentType;
  response: string;
  completed: boolean;
  assignee: { id: string; name: string } | null;
  attachmentIds: string[];
};

export type LedgerFile = { id: string; name: string; meta: string };

export type Member = { id: string; name: string; role: string };

/** The popovers a row can open; only one is open across the ledger. */
export type RowMenu = "files" | "assignee";

/** Columns shared by the header row and each comment row. */
export const ROW_GRID = "grid grid-cols-[20px_44px_minmax(0,1fr)_112px_104px] gap-x-3 px-5";

export const LABEL = "font-mono text-caption tracking-label text-ink-muted";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Status = "open" | "draft" | "completed" | "info" | "admin";

const STATUS: Record<Status, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-status-open text-status-open-ink" },
  draft: { label: "Draft", className: "bg-status-draft text-status-draft-ink" },
  completed: { label: "Completed", className: "bg-status-completed text-status-completed-ink" },
  info: { label: "Info", className: "bg-canvas text-ink-muted" },
  admin: { label: "Admin", className: "bg-canvas text-ink-muted" },
};

const BUTTON = "inline-flex h-9 flex-none cursor-pointer items-center gap-2 rounded-md px-3 whitespace-nowrap text-small font-medium disabled:cursor-default disabled:opacity-50";
const SECONDARY_BUTTON = `${BUTTON} border border-line-strong bg-white text-ink`;
const PRIMARY_BUTTON = `${BUTTON} bg-accent text-white hover:bg-accent-hover`;

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

const AVATAR_COLORS = [
  "bg-avatar-1 text-avatar-1-ink",
  "bg-avatar-2 text-avatar-2-ink",
  "bg-avatar-3 text-avatar-3-ink",
  "bg-avatar-4 text-avatar-4-ink",
  "bg-avatar-5 text-avatar-5-ink",
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

/** Same person, same color, on every row. */
function avatarColor(userId: string) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** "Ben Whitfield" → "Ben W." */
function shortName(name: string) {
  const parts = name.split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

/** "4" → "004". Labels like "A-1" or "TE 1" stay as printed. */
const displayNumber = (number: string) => (/^\d+$/.test(number) ? number.padStart(3, "0") : number);

/** Splits text around the cited references; odd entries are the references. */
function splitRefs(text: string, refs: string[]) {
  const unique = [...new Set(refs.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (unique.length === 0) return [text];
  const escaped = unique.map((ref) => ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.split(new RegExp(`(${escaped.join("|")})`, "g"));
}

/**
 * Opens the comment letter in a new tab. `#search=` jumps to the reference in
 * viewers that support it (e.g. Firefox); others open the first page.
 */
function RefLink({ href, code, children }: { href: string; code: string; children: ReactNode }) {
  return (
    <a
      href={`${href}#search=${encodeURIComponent(code)}`}
      target="_blank"
      rel="noreferrer"
      className={`-mx-2 flex items-center gap-2.5 rounded-chip px-2 py-1.5 text-ink hover:text-accent ${FOCUS_RING}`}
    >
      {children}
      <span className="font-mono text-meta font-semibold">{code}</span>
    </a>
  );
}

/** Closes a popover on a click outside `area` or on Escape, which returns focus to its button. */
function useDismiss(
  open: boolean,
  area: RefObject<HTMLElement | null>,
  button: RefObject<HTMLButtonElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!area.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onClose();
      button.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, area, button, onClose]);
}

function Avatar({ member }: { member: Member }) {
  return (
    <span
      className={`inline-flex size-6.5 flex-none items-center justify-center rounded-full text-micro font-semibold tracking-wide ring-2 ring-white ${avatarColor(
        member.id
      )}`}
    >
      {initials(member.name)}
    </span>
  );
}

/** Who's answering the comment. Opens a list of the project's team to pick from. */
function AssigneePicker({
  assignee,
  members,
  editable,
  open,
  onToggle,
  onClose,
  onAssign,
}: {
  assignee: Member | null;
  members: Member[];
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAssign: (userId: string | null) => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(open, area, button, onClose);

  const current = assignee ? (
    <>
      <Avatar member={assignee} />
      <span className="truncate text-meta text-ink-secondary">{shortName(assignee.name)}</span>
    </>
  ) : (
    <span className="text-meta text-ink-muted">Unassigned</span>
  );

  if (!editable) {
    return (
      <span className="flex min-w-0 items-center justify-center gap-2" title={assignee?.name}>
        {current}
      </span>
    );
  }

  function pick(userId: string | null) {
    onAssign(userId);
    onClose();
    button.current?.focus();
  }

  return (
    // z-10 keeps it clickable above the row's stretched toggle; z-30 when open
    // so the menu covers the pickers in the rows below.
    <div ref={area} className={`relative flex min-w-0 justify-center ${open ? "z-30" : "z-10"}`}>
      <button
        ref={button}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        title={assignee?.name}
        className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-option-hover ${FOCUS_RING}`}
      >
        {current}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-1/2 z-20 mt-1 w-60 -translate-x-1/2 rounded-lg border border-line-strong bg-white p-1.5 shadow-popover"
        >
          <div className={`px-2.5 pt-2 pb-1.5 ${LABEL}`}>ASSIGN TO</div>
          {[null, ...members].map((member) => {
            const selected = (member?.id ?? null) === (assignee?.id ?? null);
            return (
              <button
                key={member?.id ?? "unassigned"}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => pick(member?.id ?? null)}
                className={`flex min-h-9.5 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-option-hover ${FOCUS_RING}`}
              >
                {member ? (
                  <>
                    <Avatar member={member} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-small text-ink">{member.name}</span>
                      <span className="text-tiny text-ink-muted capitalize">
                        {member.role === "pm" ? "PM" : member.role}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-small text-ink-muted">Unassigned</span>
                )}
                {selected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-accent" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function CommentRow({
  comment,
  response,
  onResponseChange,
  completed,
  onToggleCompleted,
  files,
  attachedIds,
  onToggleFile,
  onUploadFile,
  letterUrl,
  assignee,
  members,
  onAssign,
  editable,
  open,
  onToggle,
  openMenu,
  onToggleMenu,
  onCloseMenu,
  isFirst,
  isLast,
}: {
  comment: LedgerComment;
  response: string;
  onResponseChange: (value: string) => void;
  completed: boolean;
  onToggleCompleted: () => void;
  files: LedgerFile[];
  attachedIds: string[];
  onToggleFile: (fileId: string) => void;
  onUploadFile: (file: File) => Promise<boolean>;
  letterUrl: string;
  assignee: Member | null;
  members: Member[];
  onAssign: (userId: string | null) => void;
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  openMenu: RowMenu | null;
  onToggleMenu: (menu: RowMenu) => void;
  onCloseMenu: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const id = useId();
  const status = STATUS[statusOf(comment.commentType, response, completed)];
  const primarySheet = comment.sheetRefs[0];
  const attached = files.filter((file) => attachedIds.includes(file.id));
  const hasRefs = comment.sheetRefs.length > 0 || comment.codeRefs.length > 0;
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
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: value }),
    }).catch(() => null);
    if (request !== latestSave.current) return; // a newer save has started
    setSaveState(!res?.ok ? "error" : value.trim() ? "saved" : "idle");
  }

  function changeResponse(value: string) {
    onResponseChange(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(value), 800);
  }

  function flushResponse() {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    save(response);
  }

  const menuOpen = openMenu === "files";
  const menuArea = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useDismiss(menuOpen, menuArea, menuButton, onCloseMenu);

  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    setUploadFailed(false);
    const ok = await onUploadFile(file);
    setUploading(false);
    setUploadFailed(!ok);
  }

  return (
    <div
      className={`relative ${isFirst ? "" : "border-t border-line-row"} ${
        open ? "bg-row-open" : "bg-white"
      } ${isLast ? "rounded-b-lg" : ""}`}
    >
      {/* The toggle stretches over the whole row (after:inset-0); the assignee picker sits above it. */}
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
          className={`col-span-3 grid cursor-pointer grid-cols-[20px_44px_minmax(0,1fr)] items-center gap-x-3 text-left after:absolute after:inset-0 ${FOCUS_RING}`}
        >
          <span className={`inline-flex justify-center transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
          <span className="font-mono text-meta text-ink-muted">{displayNumber(comment.number)}</span>
          <span className="flex min-w-0 flex-col gap-1 pr-6">
            <span className="truncate text-body font-semibold">{comment.title}</span>
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
        </button>
        <AssigneePicker
          assignee={assignee}
          members={members}
          editable={editable}
          open={openMenu === "assignee"}
          onToggle={() => onToggleMenu("assignee")}
          onClose={onCloseMenu}
          onAssign={onAssign}
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
              <div className={LABEL}>AHJ COMMENT</div>
              <p className="text-body leading-6 whitespace-pre-line text-ink-body">
                {splitRefs(comment.text, [...comment.sheetRefs, ...comment.codeRefs]).map((part, i) =>
                  i % 2 ? (
                    <span key={i} className="font-mono text-small font-semibold text-ink">
                      {part}
                    </span>
                  ) : (
                    part
                  )
                )}
              </p>
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
                        <span key={file.id} className="inline-flex h-7 max-w-60 items-center rounded-chip bg-chip px-2.5 text-meta text-chip-ink">
                          <span className="truncate">{file.name}</span>
                        </span>
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
                    <RefLink key={ref} href={letterUrl} code={ref}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="flex-none text-ink-secondary" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="1.5" />
                        <path d="M3 15h18M14 15v5" />
                      </svg>
                    </RefLink>
                  ))}
                </div>
              )}
              {comment.codeRefs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="mb-0.5 text-xs font-semibold text-ink-secondary">Codes &amp; standards</div>
                  {comment.codeRefs.map((ref) => (
                    <RefLink key={ref} href={letterUrl} code={ref}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" className="flex-none text-ink-secondary" aria-hidden="true">
                        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
                        <path d="M5 17a3 3 0 0 1 3-3h11" />
                      </svg>
                    </RefLink>
                  ))}
                </div>
              )}
            </aside>
          )}

          {/* Spans the panel so completing sits at its right edge, under the references. */}
          {editable && (
            <div className="col-span-full flex items-start justify-between gap-3">
              <div ref={menuArea} className="relative flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <button
                  ref={menuButton}
                  type="button"
                  onClick={() => onToggleMenu("files")}
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  className={`${SECONDARY_BUTTON} ${FOCUS_RING}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                  Attach files
                  {attached.length > 0 && (
                    <span className="font-mono text-tiny text-ink-muted">({attached.length})</span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {attached.map((file) => (
                  <span key={file.id} className="inline-flex h-7 max-w-60 items-center gap-1.5 rounded-chip bg-chip pr-1 pl-2.5 text-meta text-chip-ink">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => onToggleFile(file.id)}
                      aria-label={`Remove ${file.name}`}
                      className={`inline-flex size-5.5 flex-none cursor-pointer items-center justify-center rounded ${FOCUS_RING}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </span>
                ))}

                {menuOpen && (
                  <div className="absolute top-11 left-0 z-20 w-95 rounded-lg border border-line-strong bg-white p-1.5 shadow-popover">
                    <div className={`px-2.5 pt-2 pb-1.5 ${LABEL}`}>PROJECT FILES</div>
                    {files.length === 0 && (
                      <p className="px-2.5 py-2 text-small text-ink-muted">
                        No files in this package yet.
                      </p>
                    )}
                    {files.map((file) => (
                      <label
                        key={file.id}
                        htmlFor={`${id}-file-${file.id}`}
                        className="flex min-h-9.5 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.75 hover:bg-option-hover"
                      >
                        <input
                          id={`${id}-file-${file.id}`}
                          type="checkbox"
                          checked={attachedIds.includes(file.id)}
                          onChange={() => onToggleFile(file.id)}
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
                        className={`flex min-h-9.5 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.75 text-left text-small text-ink hover:bg-option-hover disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none text-ink-muted" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
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
                      {uploadFailed && (
                        <p className="px-2.5 pb-1.5 text-tiny text-status-open-ink">
                          Upload failed. Please try again.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-none items-center gap-3">
                <span aria-live="polite" className="inline-flex h-9 items-center gap-1.5 text-xs whitespace-nowrap text-ink-muted">
                  {saveState === "saved" && (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-saved" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      {completed ? "Saved" : "Draft saved"}
                    </>
                  )}
                  {saveState === "saving" && "Saving…"}
                  {saveState === "error" && (
                    <span className="text-status-open-ink">Couldn&apos;t save</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={onToggleCompleted}
                  disabled={!canComplete}
                  title={canComplete ? undefined : "Write a response first"}
                  className={`${completed ? SECONDARY_BUTTON : PRIMARY_BUTTON} ${FOCUS_RING}`}
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
