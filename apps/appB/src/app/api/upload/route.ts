import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { extractText } from "@/lib/textExtractor";
import { chunkText } from "@/lib/chunker";
import { generateEmbeddings } from "@/lib/embeddingService";
import { addEntries } from "@/lib/vectorStore";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: "pdf",
  txt: "txt",
  md: "md",
  docx: "docx",
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

interface UploadSuccessResponse {
  success: true;
  filename: string;
  size: number;
  type: string;
  chunks: number;
}

interface UploadErrorResponse {
  success: false;
  error: string;
}

type UploadResponse = UploadSuccessResponse | UploadErrorResponse;

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function isValidFileType(extension: string): boolean {
  return extension in ALLOWED_EXTENSIONS;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<UploadResponse>> {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const conversationId = formData.get("conversationId") as string | null;

  const missingFileResponse = validateFileExists(file);
  if (missingFileResponse) return missingFileResponse;

  const ext = getFileExtension(file!.name);

  const invalidTypeResponse = validateFileType(ext);
  if (invalidTypeResponse) return invalidTypeResponse;

  const oversizedResponse = validateFileSize(file!.size);
  if (oversizedResponse) return oversizedResponse;

  try {
    const buffer = Buffer.from(await file!.arrayBuffer());
    ensureUploadsDir();
    fs.writeFileSync(path.join(UPLOADS_DIR, file!.name), buffer);
    const extraction = await extractText(buffer, file!.name);
    const chunks = chunkText(extraction.text, file!.name);
    const cid = conversationId || "default";
    if (chunks.length > 0) {
      const embeddings = await generateEmbeddings(chunks.map((c) => c.text));
      addEntries(chunks.map((chunk, i) => ({ conversationId: cid, chunk, embedding: embeddings[i] })));
    }
    return NextResponse.json({
      success: true,
      filename: file!.name,
      size: file!.size,
      type: ALLOWED_EXTENSIONS[ext],
      chunks: chunks.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Document processing failed";
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}

function validateFileExists(
  file: File | null,
): NextResponse<UploadErrorResponse> | null {
  if (file) return null;
  return NextResponse.json(
    { success: false, error: "No file provided" },
    { status: 400 },
  );
}

function validateFileType(
  extension: string,
): NextResponse<UploadErrorResponse> | null {
  if (isValidFileType(extension)) return null;
  return NextResponse.json(
    {
      success: false,
      error: `Unsupported file type: ${extension}. Allowed: pdf, txt, md, docx`,
    },
    { status: 400 },
  );
}

function validateFileSize(
  size: number,
): NextResponse<UploadErrorResponse> | null {
  if (size > 0 && size <= MAX_FILE_SIZE) return null;
  if (size === 0) {
    return NextResponse.json(
      { success: false, error: "File is empty" },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: `File too large: ${(size / (1024 * 1024)).toFixed(1)}MB. Maximum: 5MB`,
    },
    { status: 400 },
  );
}
