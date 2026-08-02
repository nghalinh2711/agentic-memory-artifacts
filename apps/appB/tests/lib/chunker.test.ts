import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/chunker";
import type { Chunk } from "@/lib/types";

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("", "empty.txt")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(chunkText("   \n  \n  ", "whitespace.txt")).toEqual([]);
  });

  it("creates single chunk for short text", () => {
    const text = "This is a short document.";
    const result = chunkText(text, "short.txt");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(text);
    expect(result[0].metadata.sourceFilename).toBe("short.txt");
    expect(result[0].metadata.chunkIndex).toBe(0);
    expect(result[0].metadata.totalChunks).toBe(1);
  });

  it("preserves source filename in metadata", () => {
    const result = chunkText("Hello world", "my-doc.pdf");
    expect(result[0].metadata.sourceFilename).toBe("my-doc.pdf");
  });

  it("assigns sequential chunk indices starting from 0", () => {
    const longPara = "x".repeat(2000);
    const paragraphs = Array(20).fill(longPara).join("\n\n");
    const result = chunkText(paragraphs, "large.txt");
    expect(result.length).toBeGreaterThan(1);
    result.forEach((chunk, i) => {
      expect(chunk.metadata.chunkIndex).toBe(i);
      expect(chunk.metadata.totalChunks).toBe(result.length);
    });
  });

  it("splits on paragraph boundaries with double newlines", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const result = chunkText(text, "doc.txt");
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("First paragraph");
    expect(result[0].text).toContain("Second paragraph");
    expect(result[0].text).toContain("Third paragraph");
  });

  it("handles single newlines without splitting", () => {
    const text = "Line one.\nLine two.\nLine three.";
    const result = chunkText(text, "single.txt");
    expect(result).toHaveLength(1);
  });

  it("creates multiple chunks for text exceeding token limit", () => {
    const longPara = "x".repeat(5000);
    const text = [longPara, longPara].join("\n\n");
    const result = chunkText(text, "big.txt");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("each chunk has non-empty text", () => {
    const text = "Paragraph A.\n\nParagraph B.\n\nParagraph C.";
    const result = chunkText(text, "abc.txt");
    result.forEach((chunk) => {
      expect(chunk.text.trim().length).toBeGreaterThan(0);
    });
  });

  it("all chunks reference same totalChunks value", () => {
    const paragraphs = Array(40).fill("Medium paragraph content here.").join("\n\n");
    const result = chunkText(paragraphs, "multi.txt");
    const total = result[0].metadata.totalChunks;
    result.forEach((chunk) => {
      expect(chunk.metadata.totalChunks).toBe(total);
    });
  });

  it("handles document with only one very long paragraph", () => {
    const text = "x".repeat(10000);
    const result = chunkText(text, "long.txt");
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((chunk) => {
      expect(chunk.text.length).toBeGreaterThan(0);
    });
  });
});
