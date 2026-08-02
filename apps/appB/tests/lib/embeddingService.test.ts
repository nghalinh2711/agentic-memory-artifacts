import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateEmbedding, generateEmbeddings, computeSimilarity } from "@/lib/embeddingService";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class {
    embeddings = { create: mockCreate };
  },
}));

function makeEmbedding(length: number, value: number): number[] {
  return Array(length).fill(value);
}

describe("generateEmbedding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns embedding vector from OpenAI", async () => {
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    const result = await generateEmbedding("test text");
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: "test text",
    });
  });

  it("propagates OpenAI API errors", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit"));
    await expect(generateEmbedding("text")).rejects.toThrow("API rate limit");
  });

  it("handles empty response data", async () => {
    mockCreate.mockResolvedValueOnce({ data: [] });
    await expect(generateEmbedding("text")).rejects.toThrow();
  });
});

describe("generateEmbeddings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns multiple embedding vectors", async () => {
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: [1, 2] }, { embedding: [3, 4] }],
    });
    const result = await generateEmbeddings(["text1", "text2"]);
    expect(result).toEqual([[1, 2], [3, 4]]);
    expect(mockCreate).toHaveBeenCalledWith({
      model: "text-embedding-3-small",
      input: ["text1", "text2"],
    });
  });

  it("propagates batch embedding errors", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Batch failed"));
    await expect(generateEmbeddings(["a", "b"])).rejects.toThrow("Batch failed");
  });
});

describe("computeSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const v = makeEmbedding(1536, 0.1);
    const scores = computeSimilarity(v, [v]);
    expect(scores[0]).toBeCloseTo(1.0, 5);
  });

  it("returns 0.0 for orthogonal vectors", () => {
    const a = [1, 0];
    const b = [0, 1];
    const scores = computeSimilarity(a, [b]);
    expect(scores[0]).toBeCloseTo(0, 5);
  });

  it("returns multiple scores for multiple candidates", () => {
    const query = [1, 0];
    const candidates = [[1, 0], [0, 1]];
    const scores = computeSimilarity(query, candidates);
    expect(scores).toHaveLength(2);
    expect(scores[0]).toBeCloseTo(1, 5);
    expect(scores[1]).toBeCloseTo(0, 5);
  });

  it("returns 0 for zero vectors", () => {
    const scores = computeSimilarity([0, 0], [[0, 0]]);
    expect(scores[0]).toBe(0);
  });

  it("handles empty candidates array", () => {
    const scores = computeSimilarity([1, 2, 3], []);
    expect(scores).toEqual([]);
  });
});
