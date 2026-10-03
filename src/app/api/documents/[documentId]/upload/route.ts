import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document || document.type !== "submittal") {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const filePath = await saveUpload(file, `doc-${document.id}`);
  const updated = await db.document.update({
    where: { id: document.id },
    data: {
      filePath,
      uploadedAt: new Date(),
      submittal: { update: { status: "uploaded" } },
    },
    include: { submittal: true },
  });

  return NextResponse.json(updated);
}
