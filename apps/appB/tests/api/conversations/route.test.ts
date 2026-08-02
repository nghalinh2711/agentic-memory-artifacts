import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetAll = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/serverConversationStore", () => ({
  getAllConversations: mockGetAll,
  createConversation: mockCreate,
}));

const { GET: getAll, POST: create } = await import("@/app/api/conversations/route");

describe("GET /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no conversations exist", async () => {
    mockGetAll.mockReturnValue([]);
    const res = await getAll();
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns all conversations", async () => {
    const convs = [
      { id: "1", collectionName: "Default", messages: [], createdAt: "2024-01-01", updatedAt: "2024-01-01" },
    ];
    mockGetAll.mockReturnValue(convs);
    const res = await getAll();
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("1");
  });
});

describe("POST /api/conversations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a conversation with provided collectionName", async () => {
    const mockConv = { id: "new-1", collectionName: "MyDocs", messages: [], createdAt: "", updatedAt: "" };
    mockCreate.mockReturnValue(mockConv);
    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({ collectionName: "MyDocs" }),
    });
    const res = await create(req);
    const data = await res.json();
    expect(data.id).toBe("new-1");
    expect(data.collectionName).toBe("MyDocs");
    expect(res.status).toBe(201);
  });

  it("defaults collectionName to 'Default' when not provided", async () => {
    const mockConv = { id: "def-1", collectionName: "Default", messages: [], createdAt: "", updatedAt: "" };
    mockCreate.mockReturnValue(mockConv);
    const req = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await create(req);
    const data = await res.json();
    expect(data.collectionName).toBe("Default");
  });
});
