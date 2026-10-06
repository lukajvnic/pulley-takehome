import assert from "node:assert/strict";
import { test } from "node:test";
import { displayNumber, parseDay, plural, uploadedFileName } from "./format";

test("pads numeric comment numbers and keeps printed labels", () => {
  assert.equal(displayNumber("4"), "004");
  assert.equal(displayNumber("A-1"), "A-1");
});

test("parses letter dates at noon UTC and rejects anything else", () => {
  assert.equal(parseDay("2026-07-14")?.toISOString(), "2026-07-14T12:00:00.000Z");
  assert.equal(parseDay("July 14, 2026"), null);
  assert.equal(parseDay(null), null);
});

test("recovers the uploaded file name from a stored path", () => {
  assert.equal(uploadedFileName("letter-abc-1791314391106-comment-letter.pdf"), "comment-letter.pdf");
  assert.equal(uploadedFileName("seed-1-plans.pdf"), "seed-1-plans.pdf");
});

test("pluralizes counts", () => {
  assert.equal(plural(1, "document"), "1 document");
  assert.equal(plural(3, "document"), "3 documents");
});
