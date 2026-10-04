// Responses autosave a moment after typing stops. Anything that reads them back
// from the server, like downloading the response letter, flushes these first so
// it includes the latest edits.

const pending = new Map<string, () => Promise<void>>();

/** Registers how to finish saving `key` right away; replaces any earlier entry. */
export function trackPendingSave(key: string, flush: () => Promise<void>) {
  pending.set(key, flush);
}

export function clearPendingSave(key: string) {
  pending.delete(key);
}

export async function flushPendingSaves() {
  await Promise.all([...pending.values()].map((flush) => flush()));
}
