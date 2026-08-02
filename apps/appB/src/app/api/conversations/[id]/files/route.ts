import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { removeEntriesByFilename } from "@/lib/vectorStore";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const filename = request.nextUrl.searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ error: "filename query parameter is required" }, { status: 400 });
  }
  const removed = removeEntriesByFilename(id, filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return NextResponse.json({ success: true, removed });
}
