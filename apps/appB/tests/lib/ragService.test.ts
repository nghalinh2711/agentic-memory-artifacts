import { describe, expect, it, vi, beforeEach } from "vitest";
import { queryRAG, streamRAG } from "@/lib/ragService";
import type { RAGDependencies } from "@/lib/ragService";

const mockChatCreate = vi.fn();
const mockGenerateEmbedding = vi.fn();
const mockSearch = vi.fn();
const mockGetSourceFilenames = vi.fn(() => ["doc.pdf"]);

vi.mock("@/lib/vectorStore", () => ({
  getSourceFilenames: () => mockGetSourceFilenames(),
}));

function createMockDeps(): RAGDependencies {
  return {
    generateEmbedding: mockGenerateEmbedding,
    search: mockSearch,
    createOpenAIClient: () =>
      ({ chat: { completions: { create: mockChatCreate } } }) as unknown as ReturnType<RAGDependencies["createOpenAIClient"]>,
  };
}

function createMockStream(tokens: string[]) {
  return (async function* () {
    for (const t of tokens) {
      yield { choices: [{ delta: { content: t } }] };
    }
  })();
}

describe("queryRAG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSourceFilenames.mockReturnValue(["doc.pdf"]);
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSearch.mockReturnValue([
      {
        chunk: {
          text: "Relevant chunk content.",
          metadata: { sourceFilename: "doc.pdf", chunkIndex: 0, totalChunks: 3 },
        },
        score: 0.95,
      },
    ]);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "RAG answer." } }],
    });
  });

  it("returns answer and sources for a query", async () => {
    const result = await queryRAG({ conversationId: "conv-1", query: "What is in the doc?" }, createMockDeps());
    expect(result.answer).toBe("RAG answer.");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].chunk.metadata.sourceFilename).toBe("doc.pdf");
  });

  it("uses custom topK when provided", async () => {
    await queryRAG({ conversationId: "conv-1", query: "test", topK: 3 }, createMockDeps());
    expect(mockSearch).toHaveBeenCalledWith(expect.any(Array), "conv-1", 3);
  });

  it("defaults topK to 5 when not provided", async () => {
    await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    expect(mockSearch).toHaveBeenCalledWith(expect.any(Array), "conv-1", 5);
  });

  it("handles OpenAI chat API errors", async () => {
    mockChatCreate.mockRejectedValueOnce(new Error("Chat API error"));
    await expect(queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps())).rejects.toThrow("Chat API error");
  });

  it("handles empty choices gracefully", async () => {
    mockChatCreate.mockResolvedValueOnce({ choices: [] });
    const result = await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    expect(result.answer).toBe("No response generated.");
  });

  it("handles null message content", async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });
    const result = await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    expect(result.answer).toBe("No response generated.");
  });

  it("includes source information in results", async () => {
    const result = await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    expect(result.sources[0].chunk.text).toBeTruthy();
    expect(result.sources[0].score).toBeGreaterThan(0);
  });

  it("sends a system message instructing document-grounded answers", async () => {
    await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    const messages = mockChatCreate.mock.calls[0][0].messages;
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("summarize, compare, and synthesize");
    expect(messages[0].content).toContain("Do not introduce facts");
  });

  it("sends context in the user message", async () => {
    await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    const messages = mockChatCreate.mock.calls[0][0].messages;
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("Relevant chunk content.");
    expect(messages[1].content).toContain("doc.pdf");
  });

  it("calls LLM with available doc context when no sources match", async () => {
    mockSearch.mockReturnValue([]);
    mockGetSourceFilenames.mockReturnValue(["doc1.pdf", "doc2.md"]);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "RAG answer." } }],
    });
    const result = await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe("RAG answer.");
    expect(mockChatCreate).toHaveBeenCalled();
    const messages = mockChatCreate.mock.calls[0][0].messages;
    expect(messages[1].content).toContain("doc1.pdf");
    expect(messages[1].content).toContain("doc2.md");
  });

  it("handles no uploaded documents at all", async () => {
    mockSearch.mockReturnValue([]);
    mockGetSourceFilenames.mockReturnValue([]);
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: "No documents to search." } }],
    });
    const result = await queryRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    expect(result.sources).toEqual([]);
    expect(result.answer).toBe("No documents to search.");
    const messages = mockChatCreate.mock.calls[0][0].messages;
    expect(messages[1].content).toContain("No documents have been uploaded");
  });
});

describe("streamRAG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSourceFilenames.mockReturnValue(["doc.pdf"]);
    mockGenerateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSearch.mockReturnValue([
      {
        chunk: {
          text: "Relevant chunk content.",
          metadata: { sourceFilename: "doc.pdf", chunkIndex: 0, totalChunks: 3 },
        },
        score: 0.95,
      },
    ]);
  });

  it("yields sources first, then tokens", async () => {
    mockChatCreate.mockReturnValue(createMockStream(["Hello", " world"]));
    const events: unknown[] = [];
    for await (const event of streamRAG({ conversationId: "conv-1", query: "test" }, createMockDeps())) {
      events.push(event);
    }
    expect(events[0]).toEqual({ sources: expect.any(Array) });
    expect(events[1]).toEqual({ token: "Hello" });
    expect(events[2]).toEqual({ token: " world" });
  });

  it("yields only sources when stream has no tokens", async () => {
    mockChatCreate.mockReturnValue(createMockStream([]));
    const events: unknown[] = [];
    for await (const event of streamRAG({ conversationId: "conv-1", query: "test" }, createMockDeps())) {
      events.push(event);
    }
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ sources: expect.any(Array) });
  });

  it("propagates stream errors", async () => {
    mockChatCreate.mockImplementation(() => {
      throw new Error("Stream error");
    });
    const gen = streamRAG({ conversationId: "conv-1", query: "test" }, createMockDeps());
    await gen.next();
    await expect(gen.next()).rejects.toThrow("Stream error");
  });

  it("calls LLM for empty sources with doc list context", async () => {
    mockSearch.mockReturnValue([]);
    mockGetSourceFilenames.mockReturnValue(["a.pdf"]);
    mockChatCreate.mockReturnValue(createMockStream(["No info available"]));
    const events: unknown[] = [];
    for await (const event of streamRAG({ conversationId: "conv-1", query: "test" }, createMockDeps())) {
      events.push(event);
    }
    expect(events[0]).toEqual({ sources: [] });
    expect(events[1]).toEqual({ token: "No info available" });
    expect(mockChatCreate).toHaveBeenCalled();
  });
});
