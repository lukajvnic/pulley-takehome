import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/http";
import { findLetter, notEditable, readCommentFields } from "@/lib/comments";

// Adds a comment by hand, e.g. one the parser missed or after a failed parse.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ letterId: string }> }
) {
  const { letterId } = await params;
  const found = await findLetter(letterId);
  if (!found) return fail(404, "Comment letter not found");
  if (!found.editable) return notEditable();
  if (found.letter.parseStatus === "processing") {
    return fail(409, "This letter is still being parsed");
  }

  const result = readCommentFields(await request.json().catch(() => null));
  if ("error" in result) return fail(400, result.error);
  const { fields } = result;
  if (fields.number === undefined || fields.text === undefined) {
    return fail(400, "number and text are required");
  }

  const last = await db.comment.aggregate({
    where: { letterId },
    _max: { position: true },
  });
  const comment = await db.comment.create({
    data: {
      ...fields,
      number: fields.number,
      text: fields.text,
      letterId,
      position: (last._max.position ?? 0) + 1,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
