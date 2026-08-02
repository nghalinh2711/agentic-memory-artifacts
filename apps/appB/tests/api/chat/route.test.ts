/** @vitest-environment node */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ragService", () => ({
  queryRAG: vi.fn().mockResolvedValue({ answer: "ok", sources: [] }),
  streamRAG: vi.fn().mockReturnValue(
    (async function* () {
      yield { token: "Hello" };
      yield { token: " world" };
      yield { sources: [] };
    })(),
  ),
}));

vi.mock("@/lib/embeddingService", () => ({ generateEmbedding: vi.fn() }));
vi.mock("@/lib/vectorStore", () => ({ search: vi.fn(() => []) }));
vi.mock("openai", () => ({ default: class {} }));

import { POST } from "@/app/api/chat/route";

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  it("returns 400 for missing query", async () => {
    const req = createRequest({ conversationId: "conv-1" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("returns 400 for empty query", async () => {
    const req = createRequest({ query: "   ", conversationId: "conv-1" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("returns 400 for null query", async () => {
    const req = createRequest({ query: null, conversationId: "conv-1" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("returns 400 when conversationId is missing", async () => {
    const req = createRequest({ query: "test" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("returns SSE content type for streaming requests", async () => {
    const req = createRequest({ query: "test", conversationId: "conv-1", stream: true });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("returns SSE content type by default (streaming enabled)", async () => {
    const req = createRequest({ query: "test", conversationId: "conv-1" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0]);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
