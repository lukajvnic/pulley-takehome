// Class strings shared across the comment ledger's components.

export const LABEL = "font-mono text-caption tracking-label text-ink-muted";

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const BUTTON =
  "inline-flex h-9 flex-none cursor-pointer items-center gap-2 rounded-md px-3 whitespace-nowrap text-small font-medium disabled:cursor-default disabled:opacity-50";
export const SECONDARY_BUTTON = `${BUTTON} border border-line-strong bg-white text-ink`;
export const PRIMARY_BUTTON = `${BUTTON} bg-accent text-white hover:bg-accent-hover`;

export const INPUT = `w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-placeholder ${FOCUS_RING}`;
