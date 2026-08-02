/**
 * @vitest-environment node
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  addEntry,
  addEntries,
  getAllEntries,
  getEntryCount,
  clearStore,
  search,
  searchByChunks,
  getSourceFilenames,
  removeEntriesByConversation,
  removeEntriesByFilename,
} from "@/lib/vectorStore";
import type { Chunk, EmbeddingVector } from "@/lib/types";

const EMBEDDINGS_FILE = path.join(process.cwd(), "data", "embeddings.json");

function cleanFile() {
  if (fs.existsSync(EMBEDDINGS_FILE)) {
    fs.unlinkSync(EMBEDDINGS_FILE);
  }
}

function makeChunk(filename: string, index: number): Chunk {
  return {
    text: `Chunk ${index} from ${filename}`,
    metadata: { sourceFilename: filename, chunkIndex: index, totalChunks: 3 },
  };
}

function makeEmbedding(length: number, value: number): EmbeddingVector {
  return Array(length).fill(value);
}

describe("vectorStore", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    cleanFile();
  });

  describe("addEntry", () => {
    it("adds a single entry to the store", () => {
      addEntry({ conversationId: "test-conv", chunk: makeChunk("a.txt", 0), embedding: [0.1, 0.2] });
      expect(getEntryCount()).toBe(1);
    });
  });

  describe("addEntries", () => {
    it("adds multiple entries", () => {
      addEntries([
        { conversationId: "test-conv", chunk: makeChunk("a.txt", 0), embedding: [1, 2] },
        { conversationId: "test-conv", chunk: makeChunk("a.txt", 1), embedding: [3, 4] },
      ]);
      expect(getEntryCount()).toBe(2);
    });
  });

  describe("getAllEntries", () => {
    it("returns all stored entries", () => {
      addEntry({ conversationId: "test-conv", chunk: makeChunk("a.txt", 0), embedding: [1, 2] });
      const entries = getAllEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].chunk.metadata.sourceFilename).toBe("a.txt");
    });

    it("returns a copy, not a reference", () => {
      addEntry({ conversationId: "test-conv", chunk: makeChunk("a.txt", 0), embedding: [1, 2] });
      const entries = getAllEntries();
      entries.pop();
      expect(getEntryCount()).toBe(1);
    });
  });

  describe("clearStore", () => {
    it("removes all entries", () => {
      addEntry({ conversationId: "test-conv", chunk: makeChunk("a.txt", 0), embedding: [1, 2] });
      clearStore();
      expect(getEntryCount()).toBe(0);
    });
  });

  describe("search", () => {
    it("returns empty array for empty store", () => {
      const results = search([1, 2, 3], "test-conv", 5);
      expect(results).toEqual([]);
    });

    it("returns top-K results sorted by score descending", () => {
      const query = [1, 0, 0];
      addEntry({ conversationId: "test-conv", chunk: makeChunk("good.txt", 0), embedding: [1, 0, 0] });
      addEntry({ conversationId: "test-conv", chunk: makeChunk("bad.txt", 1), embedding: [-1, 0, 0] });
      const results = search(query, "test-conv", 2);
      expect(results).toHaveLength(2);
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].chunk.metadata.sourceFilename).toBe("good.txt");
    });

    it("limits results to topK", () => {
      for (let i = 0; i < 10; i++) {
        addEntry({
          conversationId: "test-conv",
          chunk: makeChunk(`doc${i}.txt`, i),
          embedding: [i * 0.1, 0],
        });
      }
      const results = search([1, 0], "test-conv", 3);
      expect(results).toHaveLength(3);
    });
  });

  describe("searchByChunks", () => {
    it("returns empty array for empty chunks", () => {
      const results = searchByChunks([1, 2], [], [], 5);
      expect(results).toEqual([]);
    });

    it("returns ranked chunks by similarity", () => {
      const chunks = [makeChunk("a.txt", 0), makeChunk("b.txt", 1)];
      const embeddings: EmbeddingVector[] = [[1, 0], [-1, 0]];
      const results = searchByChunks([1, 0], chunks, embeddings, 2);
      expect(results[0].chunk.metadata.sourceFilename).toBe("a.txt");
      expect(results[1].chunk.metadata.sourceFilename).toBe("b.txt");
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  describe("getSourceFilenames", () => {
    it("returns empty array for empty store", () => {
      expect(getSourceFilenames("test-conv")).toEqual([]);
    });

    it("returns unique filenames across all entries", () => {
      addEntries([
        { conversationId: "test-conv", chunk: makeChunk("a.pdf", 0), embedding: [1, 2] },
        { conversationId: "test-conv", chunk: makeChunk("a.pdf", 1), embedding: [3, 4] },
        { conversationId: "test-conv", chunk: makeChunk("b.md", 0), embedding: [5, 6] },
      ]);
      const names = getSourceFilenames("test-conv");
      expect(names).toHaveLength(2);
      expect(names).toContain("a.pdf");
      expect(names).toContain("b.md");
    });

    it("only returns filenames scoped to conversationId", () => {
      addEntries([
        { conversationId: "conv-a", chunk: makeChunk("x.pdf", 0), embedding: [1, 2] },
        { conversationId: "conv-b", chunk: makeChunk("y.md", 0), embedding: [3, 4] },
      ]);
      expect(getSourceFilenames("conv-a")).toEqual(["x.pdf"]);
      expect(getSourceFilenames("conv-b")).toEqual(["y.md"]);
    });
  });

  describe("removeEntriesByConversation", () => {
    it("removes all entries for a conversation", () => {
      addEntries([
        { conversationId: "conv-a", chunk: makeChunk("a.txt", 0), embedding: [1, 2] },
        { conversationId: "conv-a", chunk: makeChunk("a.txt", 1), embedding: [3, 4] },
        { conversationId: "conv-b", chunk: makeChunk("b.txt", 0), embedding: [5, 6] },
      ]);
      const removed = removeEntriesByConversation("conv-a");
      expect(removed).toBe(2);
      expect(getEntryCount()).toBe(1);
    });
  });

  describe("removeEntriesByFilename", () => {
    it("removes entries matching conversationId and filename", () => {
      addEntries([
        { conversationId: "conv-a", chunk: makeChunk("a.txt", 0), embedding: [1, 2] },
        { conversationId: "conv-a", chunk: makeChunk("a.txt", 1), embedding: [3, 4] },
        { conversationId: "conv-a", chunk: makeChunk("b.txt", 0), embedding: [5, 6] },
      ]);
      const removed = removeEntriesByFilename("conv-a", "a.txt");
      expect(removed).toBe(2);
      expect(getEntryCount()).toBe(1);
    });
  });

  describe("persistence", () => {
    it("survives clearStore and re-reads empty state", () => {
      addEntry({ conversationId: "conv", chunk: makeChunk("a.txt", 0), embedding: [1, 2] });
      expect(getEntryCount()).toBe(1);
      clearStore();
      expect(getEntryCount()).toBe(0);
      expect(getAllEntries()).toEqual([]);
    });

    it("persists data to disk after adds", () => {
      addEntry({ conversationId: "conv", chunk: makeChunk("a.txt", 0), embedding: [1, 2] });
      const raw = fs.readFileSync(EMBEDDINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].conversationId).toBe("conv");
    });

    it("persists removals to disk", () => {
      addEntries([
        { conversationId: "conv", chunk: makeChunk("a.txt", 0), embedding: [1, 2] },
        { conversationId: "conv", chunk: makeChunk("a.txt", 1), embedding: [3, 4] },
      ]);
      removeEntriesByConversation("conv");
      const raw = fs.readFileSync(EMBEDDINGS_FILE, "utf-8");
      expect(JSON.parse(raw)).toEqual([]);
    });
  });
});
