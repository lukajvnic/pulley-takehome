// Class strings shared across the app's components.

export const LABEL = "font-mono text-caption tracking-label text-ink-muted";

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Text links, and buttons that look like them. */
export const LINK = `text-accent hover:text-accent-hover ${FOCUS_RING}`;

const BUTTON = `inline-flex h-9 flex-none cursor-pointer items-center gap-2 rounded-md px-3 whitespace-nowrap text-small font-medium disabled:cursor-default disabled:opacity-50 ${FOCUS_RING}`;
export const SECONDARY_BUTTON = `${BUTTON} border border-line-strong bg-white text-ink`;
export const PRIMARY_BUTTON = `${BUTTON} bg-accent text-white hover:bg-accent-hover`;

export const INPUT = `w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-placeholder ${FOCUS_RING}`;

/** A choice in a popover's list. */
export const OPTION = `flex min-h-9.5 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-option-hover ${FOCUS_RING}`;
