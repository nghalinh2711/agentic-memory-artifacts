import { describe, expect, it, vi, beforeEach } from "vitest";
import { extractText } from "@/lib/textExtractor";

function createBuffer(content: string): Buffer {
  return Buffer.from(content, "utf-8");
}

const mockGetText = vi.fn().mockResolvedValue({ text: "Mocked PDF text content." });

vi.mock("pdf-parse", () => {
  class MockPDFParse {
    constructor(_buffer: Uint8Array) {}
    getText() {
      return mockGetText();
    }
  }
  return { PDFParse: MockPDFParse };
});

vi.mock("mammoth", () => ({
  extractRawText: vi.fn().mockResolvedValue({ value: "Mocked DOCX text content." }),
}));

beforeEach(() => {
  mockGetText.mockResolvedValue({ text: "Mocked PDF text content." });
});

describe("extractText", () => {
  it("extracts text from TXT files", async () => {
    const result = await extractText(createBuffer("Hello world"), "doc.txt");
    expect(result.text).toBe("Hello world");
  });

  it("extracts text from MD files", async () => {
    const result = await extractText(
      createBuffer("# Heading\n\nContent"),
      "readme.md",
    );
    expect(result.text).toContain("# Heading");
    expect(result.text).toContain("Content");
  });

  it("throws for unsupported file type", async () => {
    await expect(
      extractText(createBuffer("data"), "image.png"),
    ).rejects.toThrow("Unsupported file type");
  });

  it("throws for empty buffer", async () => {
    await expect(
      extractText(Buffer.alloc(0), "empty.txt"),
    ).rejects.toThrow("Empty document");
  });

  it("throws for file with no extension", async () => {
    await expect(
      extractText(createBuffer("data"), "noextension"),
    ).rejects.toThrow("Unsupported file type");
  });

  it("extracts text from PDF files using mocked parser", async () => {
    const result = await extractText(createBuffer("fake pdf"), "doc.pdf");
    expect(result.text).toBe("Mocked PDF text content.");
  });

  it("extracts text from DOCX files using mocked parser", async () => {
    const result = await extractText(createBuffer("fake docx"), "report.docx");
    expect(result.text).toBe("Mocked DOCX text content.");
  });

  it("handles TXT with UTF-8 multibyte characters", async () => {
    const result = await extractText(
      createBuffer("日本語のテキスト"),
      "japanese.txt",
    );
    expect(result.text).toBe("日本語のテキスト");
  });

  it("handles PDF parsing errors gracefully", async () => {
    mockGetText.mockRejectedValueOnce(new Error("PDF parse error"));
    await expect(
      extractText(createBuffer("corrupt"), "corrupt.pdf"),
    ).rejects.toThrow("PDF parse error");
  });

  it("handles DOCX parsing errors gracefully", async () => {
    const mammoth = await import("mammoth");
    vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(new Error("DOCX parse error"));
    await expect(
      extractText(createBuffer("corrupt"), "corrupt.docx"),
    ).rejects.toThrow("DOCX parse error");
  });
});
