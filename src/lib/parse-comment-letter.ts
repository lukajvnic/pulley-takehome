import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { CommentType } from "@prisma/client";
import { db } from "@/lib/db";
import { UPLOADS_DIR } from "@/lib/uploads";

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

const INSTRUCTIONS = `You extract review comments from plan review comment letters that a jurisdiction (city, county, fire department, utility, etc.) sends back on a permit submittal.

Return every item the jurisdiction lists, in the order it appears:
- number: the item's label exactly as printed, without trailing punctuation or notes like "(repeat)". Examples: "4", "A-1", "TE 1", "1.03". Use "" if the item has no printed label.
- discipline: the section heading or review discipline the item is under, e.g. "Structural" or "Drainage Engineering". null if the letter has no sections.
- title: a short summary of what the item asks for, at most 8 words, starting with a verb where it fits, e.g. "Provide structural calcs for rooftop units". Write it yourself; don't copy the first sentence.
- text: the full item text, verbatim, without the label. Keep sub-items and list entries on their own lines. Write tables as plain text rows.
- sheetRefs: sheet numbers of the drawings the item cites, e.g. "A-101", "S-201". Only sheet numbers, not sheet names like "cover sheet" or "site plan". [] if none.
- codeRefs: codes, ordinances and standards the item cites, e.g. "CBC 1010.1.1", "NFPA 13 (2022) 28.2.4.2". [] if none.
- commentType:
  - "correction": the team has to revise something or respond in writing.
  - "informational": the letter says no response is required, or the item is only a note.
  - "administrative": fees, insurance, bonds, agreements, approvals from other agencies and similar items required before the permit is issued, listed apart from the review comments.

Skip:
- letterhead, resubmittal instructions, signatures and boilerplate;
- disciplines that report no comments or no review required;
- administrative items the letter marks as received or complete;
- handwritten notes, stamps and markups added by the recipient. Only extract what the jurisdiction wrote.

letterDate is the date the letter was issued (YYYY-MM-DD). reviewerName is the reviewer or plans examiner who wrote it. Use null when the letter doesn't say.`;

type ParsedLetter = {
  letterDate: string | null;
  reviewerName: string | null;
  comments: {
    number: string;
    discipline: string | null;
    title: string;
    text: string;
    sheetRefs: string[];
    codeRefs: string[];
    commentType: CommentType;
  }[];
};

// JSON schema for ParsedLetter. Strict mode needs every property required and
// no additional properties; optional values are expressed as nullable.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["letterDate", "reviewerName", "comments"],
  properties: {
    letterDate: { type: ["string", "null"] },
    reviewerName: { type: ["string", "null"] },
    comments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "discipline", "title", "text", "sheetRefs", "codeRefs", "commentType"],
        properties: {
          number: { type: "string" },
          discipline: { type: ["string", "null"] },
          title: { type: "string" },
          text: { type: "string" },
          sheetRefs: { type: "array", items: { type: "string" } },
          codeRefs: { type: "array", items: { type: "string" } },
          commentType: { type: "string", enum: Object.keys(CommentType) },
        },
      },
    },
  },
};

/** "2026-07-14" → noon UTC that day, so the date doesn't shift across timezones. */
function toDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : null;
}

/** Sends a letter PDF to the model and returns what it extracted. */
export async function extractComments(pdf: Buffer, filename: string, model = MODEL) {
  // The SDK retries rate limits, server errors and timeouts with backoff.
  const openai = new OpenAI({ maxRetries: 3 });
  const response = await openai.responses.create({
    model,
    instructions: INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename,
            file_data: `data:application/pdf;base64,${pdf.toString("base64")}`,
          },
          { type: "input_text", text: "Extract the comments from this letter." },
        ],
      },
    ],
    text: {
      format: { type: "json_schema", name: "comment_letter", schema: SCHEMA, strict: true },
    },
  });
  return { parsed: JSON.parse(response.output_text) as ParsedLetter, usage: response.usage };
}

/**
 * Extracts the comments from an uploaded letter and stores them. Runs in the
 * background after the upload responds; the outcome is recorded on the letter's
 * parseStatus, and a failure leaves the team to add comments by hand.
 */
export async function parseCommentLetter(letterId: string) {
  try {
    const document = await db.document.findUniqueOrThrow({ where: { id: letterId } });
    const pdf = await fs.readFile(path.join(UPLOADS_DIR, document.filePath!));
    const { parsed } = await extractComments(pdf, document.name);

    await db.$transaction([
      db.comment.createMany({
        data: parsed.comments.map((comment, i) => ({
          ...comment,
          letterId,
          position: i + 1,
        })),
      }),
      db.commentLetter.update({
        where: { documentId: letterId },
        data: {
          parseStatus: "done",
          letterDate: toDate(parsed.letterDate),
          reviewerName: parsed.reviewerName,
        },
      }),
    ]);
  } catch (error) {
    console.error(`Parsing comment letter ${letterId} failed:`, error);
    await db.commentLetter.update({
      where: { documentId: letterId },
      data: {
        parseStatus: "failed",
        parseError: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
