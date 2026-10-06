import assert from "node:assert/strict";
import { test } from "node:test";
import { readCommentFields } from "./comments";

test("reads only the fields that were sent", () => {
  assert.deepEqual(readCommentFields({ response: "Revised on A-101.", completed: true }), {
    fields: { response: "Revised on A-101.", completed: true },
  });
});

test("trims text and stores blank optional fields as null", () => {
  assert.deepEqual(readCommentFields({ text: "  Provide calcs.  ", discipline: "   " }), {
    fields: { text: "Provide calcs.", discipline: null },
  });
});

test("dedupes reference lists and splits out assignee ids", () => {
  assert.deepEqual(readCommentFields({ sheetRefs: ["A-101", "A-101"], assigneeIds: ["u1", "u1"] }), {
    fields: { sheetRefs: ["A-101"] },
    assigneeIds: ["u1"],
  });
});

test("rejects invalid input", () => {
  assert.ok("error" in readCommentFields(null));
  assert.ok("error" in readCommentFields([]));
  assert.ok("error" in readCommentFields({ text: "   " }));
  assert.ok("error" in readCommentFields({ commentType: "urgent" }));
  assert.ok("error" in readCommentFields({ completed: "yes" }));
  assert.ok("error" in readCommentFields({ codeRefs: [1] }));
});
