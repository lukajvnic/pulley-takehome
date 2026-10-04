// Finds a comment's text in a PDF's text layer so the viewer can highlight it.
// Matching keeps only letters and digits: the parsed text and the PDF differ in
// line breaks, hyphenation, quotes and spacing, but not in their words.

/** A page's text items in order, as PDF.js returns them (text items only). */
type PageText = string[];

/** Where the comment starts, and the characters to mark: page → item → [start, end). */
export type Highlight = {
  pageNumber: number;
  ranges: Map<number, Map<number, [start: number, end: number]>>;
};

type Position = { item: number; offset: number };

const KEEP = /[\p{L}\p{N}]/u;

/** The text's letters and digits, lowercased. */
function normalize(text: string) {
  return [...text.normalize("NFKC").toLowerCase()].filter((ch) => KEEP.test(ch)).join("");
}

/** A page's normalized text, plus where in the items each character came from. */
function indexPage(items: PageText) {
  let chars = "";
  const positions: Position[] = [];
  items.forEach((str, item) => {
    for (let offset = 0; offset < str.length; offset++) {
      for (const ch of str[offset].normalize("NFKC").toLowerCase()) {
        if (!KEEP.test(ch)) continue;
        chars += ch;
        positions.push({ item, offset });
      }
    }
  });
  return { chars, positions };
}

function addRanges(highlight: Highlight, pageNumber: number, positions: Position[]) {
  const items = highlight.ranges.get(pageNumber) ?? new Map();
  for (const { item, offset } of positions) {
    const range = items.get(item);
    items.set(item, range ? [Math.min(range[0], offset), Math.max(range[1], offset + 1)] : [offset, offset + 1]);
  }
  highlight.ranges.set(pageNumber, items);
}

/**
 * Locates `text` in the document's pages. Searches for its opening (80
 * characters, then 40 if that misses) and marks the full length from there,
 * continuing onto the next page when the comment runs past a page break.
 */
export function locateText(pages: PageText[], text: string): Highlight | null {
  const needle = normalize(text);
  if (!needle) return null;
  const indexed = pages.map(indexPage);

  for (const keyLength of [80, 40]) {
    const key = needle.slice(0, keyLength);
    const page = indexed.findIndex((p) => p.chars.includes(key));
    if (page === -1) continue;

    const highlight: Highlight = { pageNumber: page + 1, ranges: new Map() };
    let from = indexed[page].chars.indexOf(key);
    let remaining = needle.length;
    for (let p = page; p < indexed.length && remaining > 0; p++) {
      const { chars, positions } = indexed[p];
      const to = Math.min(from + remaining, chars.length);
      addRanges(highlight, p + 1, positions.slice(from, to));
      remaining -= to - from;

      // The rest should pick up near the top of the next page, after any
      // running header; if it doesn't, stop at this page.
      const rest = needle.slice(needle.length - remaining, needle.length - remaining + 20);
      from = indexed[p + 1]?.chars.indexOf(rest) ?? -1;
      if (from === -1 || from > 200) break;
    }
    return highlight;
  }
  return null;
}
