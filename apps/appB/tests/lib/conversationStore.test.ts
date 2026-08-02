import { describe, expect, it, beforeEach, vi } from "vitest";
import { createConversationStore } from "@/lib/conversationStore";
import type { ConversationStore, Conversation } from "@/lib/types";

function mockConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "abc123",
    name: "Default",
    collectionName: "Default",
    messages: [],
    uploadedFiles: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ConversationStore (API-based)", () => {
  let store: ConversationStore;

  beforeEach(() => {
    vi.restoreAllMocks();
    store = createConversationStore();
  });

  describe("createConversation", () => {
    it("creates a conversation via POST /api/conversations", async () => {
      const conv = mockConversation({ collectionName: "my-collection" });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(conv), { status: 201 }),
      );

      const result = await store.createConversation("my-collection");
      expect(result.collectionName).toBe("my-collection");
      expect(result.messages).toEqual([]);
      expect(result.id).toBe("abc123");
    });

    it("assigns unique IDs to each conversation", async () => {
      const a = mockConversation({ id: "id-a" });
      const b = mockConversation({ id: "id-b" });
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response(JSON.stringify(a), { status: 201 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(b), { status: 201 }));

      const resultA = await store.createConversation("a");
      const resultB = await store.createConversation("b");
      expect(resultA.id).not.toBe(resultB.id);
    });
  });

  describe("getConversation", () => {
    it("returns null for 404 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
      );
      const result = await store.getConversation("nonexistent");
      expect(result).toBeNull();
    });

    it("returns the conversation by ID", async () => {
      const conv = mockConversation({ id: "found-id" });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(conv), { status: 200 }),
      );
      const result = await store.getConversation("found-id");
      expect(result).not.toBeNull();
      expect(result!.id).toBe("found-id");
    });
  });

  describe("getAllConversations", () => {
    it("returns empty array", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify([]), { status: 200 }),
      );
      const result = await store.getAllConversations();
      expect(result).toEqual([]);
    });

    it("returns all conversations", async () => {
      const all = [mockConversation({ id: "a" }), mockConversation({ id: "b" })];
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(all), { status: 200 }),
      );
      const result = await store.getAllConversations();
      expect(result).toHaveLength(2);
    });
  });

  describe("updateConversation", () => {
    it("updates messages via PUT", async () => {
      const updated = mockConversation({
        id: "conv1",
        messages: [{ role: "user", content: "Hello" }],
      });
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(updated), { status: 200 }),
      );
      const result = await store.updateConversation("conv1", {
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].content).toBe("Hello");
    });

    it("throws when API returns 404", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Conversation \"x\" not found" }), { status: 404 }),
      );
      await expect(store.updateConversation("x", { messages: [] })).rejects.toThrow(/not found/);
    });
  });

  describe("deleteConversation", () => {
    it("removes a conversation via DELETE", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
      await expect(store.deleteConversation("abc")).resolves.toBeUndefined();
    });

    it("throws when API returns 404", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
      );
      await expect(store.deleteConversation("nonexistent")).rejects.toThrow(/not found/);
    });
  });

  describe("error handling", () => {
    it("throws on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
      await expect(store.getAllConversations()).rejects.toThrow("Network error");
    });

    it("throws on non-ok response without error body", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 }),
      );
      await expect(store.getAllConversations()).rejects.toThrow("Request failed");
    });
  });
});
