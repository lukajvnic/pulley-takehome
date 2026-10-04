"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/TextLayer.css";
import { locateText, type Highlight } from "@/components/letter-viewer/find-text";

// react-pdf requires the worker to be set in the module that renders <Document>.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/** The comment to highlight: its text to search for, and the parsed page as a fallback. */
export type ViewerTarget = { text: string; page: number | null };

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Transparent text: the text layer sits over the rendered page, so only the tint shows.
const MARK = "rounded-xs bg-accent/25 text-transparent";

/** Every page of the letter, fitted to the column, with `target` highlighted. */
export default function PdfPages({
  fileUrl,
  target,
}: {
  fileUrl: string;
  target: ViewerTarget | null;
}) {
  const column = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);
  const [width, setWidth] = useState<number>();
  const [numPages, setNumPages] = useState(0);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Pages fit the column: measured as soon as it mounts (a resize observer alone
  // never fires in a background tab), then kept in step with resizes.
  const measureColumn = useCallback((element: HTMLDivElement | null) => {
    column.current = element;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  async function onLoad(pdf: PDFDocumentProxy) {
    setNumPages(pdf.numPages);
    if (!target) return;
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, i) => {
        const content = await (await pdf.getPage(i + 1)).getTextContent();
        // Text items only, counted the way react-pdf counts customTextRenderer's itemIndex.
        return content.items.flatMap((item) => ("str" in item ? [item.str] : []));
      })
    );
    const found = locateText(pages, target.text);
    setHighlight(found);
    setNotFound(!found);
  }

  // One renderer per highlighted page, wrapping the matched characters in <mark>.
  const renderers = useMemo(() => {
    const byPage = new Map<number, (item: { str: string; itemIndex: number }) => string>();
    highlight?.ranges.forEach((items, pageNumber) => {
      byPage.set(pageNumber, ({ str, itemIndex }) => {
        const range = items.get(itemIndex);
        if (!range) return escapeHtml(str);
        const [start, end] = range;
        return `${escapeHtml(str.slice(0, start))}<mark class="${MARK}">${escapeHtml(
          str.slice(start, end)
        )}</mark>${escapeHtml(str.slice(end))}`;
      });
    });
    return byPage;
  }, [highlight]);

  function scrollToHighlight() {
    const mark = column.current?.querySelector("mark");
    if (scrolled.current || !mark) return;
    scrolled.current = true;
    mark.scrollIntoView({ block: "center" });
  }

  // Without a match, open the page the parser placed the comment on.
  const fallbackPage = Math.min(Math.max(target?.page ?? 1, 1), numPages || 1);
  useEffect(() => {
    if (!notFound || !numPages) return;
    document.getElementById(`letter-page-${fallbackPage}`)?.scrollIntoView({ block: "start" });
  }, [notFound, numPages, fallbackPage]);

  return (
    <div className="flex flex-col gap-4">
      {notFound && (
        <p className="rounded-lg border border-line bg-white px-4 py-3 text-small text-ink-secondary">
          Couldn&apos;t find this comment&apos;s text in the PDF. It may be a scanned letter, or the
          comment was edited after parsing.{" "}
          {target?.page ? `Showing page ${fallbackPage}, where it starts.` : "Showing the first page."}
        </p>
      )}

      <div ref={measureColumn}>
        <Document
          file={fileUrl}
          onLoadSuccess={onLoad}
          loading={<p className="text-small text-ink-muted">Loading the letter…</p>}
          error={<p className="text-small text-status-open-ink">Couldn&apos;t load this PDF.</p>}
        >
          {width &&
            Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
              <div
                key={pageNumber}
                id={`letter-page-${pageNumber}`}
                className="mb-4 scroll-mt-4 overflow-hidden rounded-lg border border-line bg-white"
              >
                <Page
                  pageNumber={pageNumber}
                  width={width - 2}
                  renderAnnotationLayer={false}
                  customTextRenderer={renderers.get(pageNumber)}
                  onRenderTextLayerSuccess={
                    pageNumber === highlight?.pageNumber ? scrollToHighlight : undefined
                  }
                />
              </div>
            ))}
        </Document>
      </div>
    </div>
  );
}
