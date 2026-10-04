"use client";

import dynamic from "next/dynamic";

/** A comment letter's pages. PDF.js needs the browser, so they never render on the server. */
export const LetterViewer = dynamic(() => import("@/components/letter-viewer/PdfPages"), {
  ssr: false,
  loading: () => <p className="text-small text-ink-muted">Loading the letter…</p>,
});
