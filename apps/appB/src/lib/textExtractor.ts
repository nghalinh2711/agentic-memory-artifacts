import { ExtractionResult } from "./types";

type FileType = "pdf" | "txt" | "md" | "docx";

function detectFileType(filename: string): FileType | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, FileType> = {
    pdf: "pdf", txt: "txt", md: "md", docx: "docx",
  };
  return map[ext] ?? null;
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse(new Uint8Array(buffer));
  const result = await parser.getText();
  return { text: result.text, pageCount: undefined };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value };
}

function extractTextFile(buffer: Buffer): ExtractionResult {
  return { text: buffer.toString("utf-8") };
}

export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<ExtractionResult> {
  const fileType = detectFileType(filename);
  if (!fileType) throw new Error(`Unsupported file type: ${filename}`);
  if (buffer.length === 0) throw new Error("Empty document");
  if (fileType === "pdf") return extractPdf(buffer);
  if (fileType === "docx") return extractDocx(buffer);
  return extractTextFile(buffer);
}
