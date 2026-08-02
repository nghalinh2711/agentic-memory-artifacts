/** @vitest-environment node */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { extractText } from "@/lib/textExtractor";
import { chunkText } from "@/lib/chunker";
import { generateEmbeddings } from "@/lib/embeddingService";
import { addEntries, clearStore, searchByChunks } from "@/lib/vectorStore";
import type { Chunk, EmbeddingVector } from "@/lib/types";

const TEST_TXT_CONTENT = "The quick brown fox jumps over the lazy dog.";

function createTestBuffer(content: string): Buffer {
  return Buffer.from(content, "utf-8");
}

describe("Full RAG Pipeline (integration)", () => {
  beforeAll(() => {
    clearStore();
  });

  afterAll(() => {
    clearStore();
  });

  it("extracts text from a TXT file", async () => {
    const buffer = createTestBuffer(TEST_TXT_CONTENT);
    const result = await extractText(buffer, "test.txt");
    expect(result.text).toBe(TEST_TXT_CONTENT);
  });

  it("chunks extracted text", () => {
    const chunks = chunkText(TEST_TXT_CONTENT, "test.txt");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.sourceFilename).toBe("test.txt");
  });

  it("generates embeddings for chunks when API key is configured", async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("Skipping embedding test: OPENAI_API_KEY not set");
      return;
    }
    const chunks = chunkText(TEST_TXT_CONTENT, "test.txt");
    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);
    expect(embeddings).toHaveLength(chunks.length);
    expect(embeddings[0]).toBeInstanceOf(Array);
    expect(embeddings[0].length).toBeGreaterThan(0);
  });

  it("stores and retrieves chunks with embeddings", async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("Skipping store/retrieve test: OPENAI_API_KEY not set");
      return;
    }
    clearStore();
    const chunks = chunkText(TEST_TXT_CONTENT, "test.txt");
    const embeddings = await generateEmbeddings(chunks.map((c) => c.text));
    const entries = chunks.map((chunk, i) => ({ conversationId: "test", chunk, embedding: embeddings[i] }));
    addEntries(entries);
    const results = searchByChunks(embeddings[0], chunks, embeddings, 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.metadata.sourceFilename).toBe("test.txt");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("completes the full RAG pipeline: extract → chunk → embed → store → retrieve", async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("Skipping full pipeline test: OPENAI_API_KEY not set");
      return;
    }
    clearStore();
    const content = "Artificial intelligence is transforming how we work.";
    const buffer = createTestBuffer(content);
    const extraction = await extractText(buffer, "ai.txt");
    expect(extraction.text).toBeTruthy();
    const chunks = chunkText(extraction.text, "ai.txt");
    expect(chunks.length).toBeGreaterThan(0);
    const embeddings = await generateEmbeddings(chunks.map((c) => c.text));
    expect(embeddings).toHaveLength(chunks.length);
    addEntries(chunks.map((c, i) => ({ conversationId: "test", chunk: c, embedding: embeddings[i] })));
    const queryEmbedding = await generateEmbeddings(["artificial intelligence"]);
    const results = searchByChunks(queryEmbedding[0], chunks, embeddings, 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });
});
