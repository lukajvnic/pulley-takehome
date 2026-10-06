import assert from "node:assert/strict";
import { test } from "node:test";
import { locateText } from "./find-text";

test("finds a comment despite different line breaks, hyphens and quotes", () => {
  const pages = [
    ["Intro text."],
    ["4. Provide structural", "calcs for the roof-", "top units per “CBC 1607”."],
  ];
  const found = locateText(pages, "Provide structural calcs for the rooftop units per \"CBC 1607\".");
  assert.equal(found?.pageNumber, 2);
  // Every item holding the comment's text is marked.
  assert.deepEqual([...found!.ranges.get(2)!.keys()], [0, 1, 2]);
});

test("follows a comment onto the next page", () => {
  const pages = [
    ["1. Show the egress path from Stair 2 to the public way and"],
    ["dimension the exit discharge."],
  ];
  const found = locateText(pages, "Show the egress path from Stair 2 to the public way and dimension the exit discharge.");
  assert.equal(found?.pageNumber, 1);
  assert.ok(found?.ranges.has(2));
});

test("returns null when the text isn't in the letter", () => {
  assert.equal(locateText([["Unrelated letter text."]], "Provide a soils report."), null);
});

test("returns null for a scan with no text layer", () => {
  assert.equal(locateText([[], []], "Provide a soils report."), null);
});
