"use client";

import dynamic from "next/dynamic";
import type { ViewerTarget } from "@/components/letter-viewer/PdfPages";

// PDF.js needs the browser, so the pages never render on the server.
const PdfPages = dynamic(() => import("@/components/letter-viewer/PdfPages"), {
  ssr: false,
  loading: () => <p className="text-small text-ink-muted">Loading the letter…</p>,
});

export function LetterViewer({ fileUrl, target }: { fileUrl: string; target: ViewerTarget | null }) {
  return <PdfPages fileUrl={fileUrl} target={target} />;
}
