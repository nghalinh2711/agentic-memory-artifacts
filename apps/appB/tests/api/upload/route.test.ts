/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/upload/route";

vi.mock("@/lib/textExtractor");
vi.mock("@/lib/chunker");
vi.mock("@/lib/embeddingService");
vi.mock("@/lib/vectorStore");
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => "[]"),
  },
}));

import { extractText } from "@/lib/textExtractor";
import { chunkText } from "@/lib/chunker";
import { generateEmbeddings } from "@/lib/embeddingService";
import { addEntries } from "@/lib/vectorStore";

const extractTextMock = vi.mocked(extractText);
const chunkTextMock = vi.mocked(chunkText);
const generateEmbeddingsMock = vi.mocked(generateEmbeddings);
const addEntriesMock = vi.mocked(addEntries);

function createFormData(file: File | null): FormData {
  const fd = new FormData();
  if (file) fd.append("file", file);
  fd.append("conversationId", "conv-1");
  return fd;
}

function createRequest(formData: FormData): Request {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    body: formData,
  });
}

function setupProcessingMocks() {
  extractTextMock.mockResolvedValue({ text: "Sample extracted text." });
  chunkTextMock.mockReturnValue([
    { text: "Chunk 1", metadata: { sourceFilename: "test.txt", chunkIndex: 0, totalChunks: 2 } },
    { text: "Chunk 2", metadata: { sourceFilename: "test.txt", chunkIndex: 1, totalChunks: 2 } },
  ]);
  generateEmbeddingsMock.mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]);
  addEntriesMock.mockReturnValue(undefined);
}

describe("POST /api/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when no file is provided", async () => {
    const req = createRequest(createFormData(null));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain("No file");
  });

  it("returns 400 for unsupported file type", async () => {
    const file = new File(["img"], "photo.png", { type: "image/png" });
    const req = createRequest(createFormData(file));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("Unsupported");
  });

  it("returns 400 for empty file", async () => {
    const file = new File([], "empty.txt", { type: "text/plain" });
    const req = createRequest(createFormData(file));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("empty");
  });

  it("returns 400 for oversized file", async () => {
    const content = Buffer.alloc(6 * 1024 * 1024).toString();
    const file = new File([content], "big.pdf", { type: "application/pdf" });
    const req = createRequest(createFormData(file));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("large");
  });

  it("returns 400 for file with no extension", async () => {
    const file = new File(["content"], "noextension", { type: "text/plain" });
    const req = createRequest(createFormData(file));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("Unsupported");
  });

  it("processes and indexes a valid PDF file", async () => {
    setupProcessingMocks();
    const file = new File(["pdf content"], "doc.pdf", { type: "application/pdf" });
    const req = createRequest(createFormData(file));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.filename).toBe("doc.pdf");
    expect(body.type).toBe("pdf");
    expect(body.chunks).toBe(2);
    expect(extractTextMock).toHaveBeenCalled();
    expect(chunkTextMock).toHaveBeenCalledWith("Sample extracted text.", "doc.pdf");
    expect(generateEmbeddingsMock).toHaveBeenCalledWith(["Chunk 1", "Chunk 2"]);
    expect(addEntriesMock).toHaveBeenCalled();
  });

  it("processes and indexes a valid TXT file", async () => {
    setupProcessingMocks();
    const file = new File(["Hello world"], "notes.txt", { type: "text/plain" });
    const req = createRequest(createFormData(file));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.type).toBe("txt");
    expect(body.chunks).toBe(2);
  });

  it("handles processing errors gracefully", async () => {
    extractTextMock.mockRejectedValue(new Error("PDF parse error"));
    const file = new File(["bad"], "bad.pdf", { type: "application/pdf" });
    const req = createRequest(createFormData(file));
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    const body = await res.json();
    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toBe("PDF parse error");
  });
});
