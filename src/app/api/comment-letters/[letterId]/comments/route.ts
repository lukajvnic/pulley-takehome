import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findLetter, isProjectMember, readCommentFields } from "@/lib/comments";

// Adds a comment by hand, e.g. one the parser missed or after a failed parse.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ letterId: string }> }
) {
  const { letterId } = await params;
  const found = await findLetter(letterId);
  if (!found) {
    return NextResponse.json({ error: "Comment letter not found" }, { status: 404 });
  }
  if (!found.editable) {
    return NextResponse.json(
      { error: "Comments can only be changed on the current letter while responding" },
      { status: 409 }
    );
  }
  if (found.letter.parseStatus === "processing") {
    return NextResponse.json(
      { error: "This letter is still being parsed" },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }
  const result = readCommentFields(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { fields } = result;
  if (fields.number === undefined || fields.text === undefined) {
    return NextResponse.json({ error: "number and text are required" }, { status: 400 });
  }
  if (
    fields.assigneeId &&
    !(await isProjectMember(found.approval.permit.projectId, fields.assigneeId))
  ) {
    return NextResponse.json(
      { error: "Assignee must be a member of the project" },
      { status: 400 }
    );
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
