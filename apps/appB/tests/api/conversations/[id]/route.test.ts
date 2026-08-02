import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { removeEntriesByConversation } from "@/lib/vectorStore";
import fs from "node:fs";

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/serverConversationStore", () => ({
  getConversation: mockGet,
  updateConversation: mockUpdate,
  deleteConversation: mockDelete,
}));
vi.mock("@/lib/vectorStore");
vi.mock("node:fs", () => ({
  default: { existsSync: vi.fn(() => false), unlinkSync: vi.fn(), mkdirSync: vi.fn(), writeFileSync: vi.fn(), readFileSync: vi.fn(() => "[]") },
}));

const { GET: getOne, PUT: update, DELETE: remove } = await import("@/app/api/conversations/[id]/route");
const mockRemoveEntries = vi.mocked(removeEntriesByConversation);
const mockFs = vi.mocked(fs);

describe("GET /api/conversations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns conversation by ID", async () => {
    const conv = { id: "abc", collectionName: "Docs", messages: [], createdAt: "", updatedAt: "" };
    mockGet.mockReturnValue(conv);
    const req = new NextRequest("http://localhost/api/conversations/abc");
    const res = await getOne(req, { params: Promise.resolve({ id: "abc" }) });
    const data = await res.json();
    expect(data.id).toBe("abc");
  });

  it("returns 404 for non-existent conversation", async () => {
    mockGet.mockReturnValue(null);
    const req = new NextRequest("http://localhost/api/conversations/none");
    const res = await getOne(req, { params: Promise.resolve({ id: "none" }) });
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.error).toBe("Conversation not found");
  });
});

describe("PUT /api/conversations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates conversation messages", async () => {
    const updated = { id: "conv1", name: "Docs", collectionName: "Docs", uploadedFiles: [], messages: [{ role: "user", content: "Hi" }], createdAt: "", updatedAt: "" };
    mockUpdate.mockReturnValue(updated);
    const req = new NextRequest("http://localhost/api/conversations/conv1", {
      method: "PUT", body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
    });
    const res = await update(req, { params: Promise.resolve({ id: "conv1" }) });
    const data = await res.json();
    expect(data.messages).toHaveLength(1);
  });

  it("renames conversation", async () => {
    const updated = { id: "conv1", name: "NewName", collectionName: "Docs", uploadedFiles: [], messages: [], createdAt: "", updatedAt: "" };
    mockUpdate.mockReturnValue(updated);
    const req = new NextRequest("http://localhost/api/conversations/conv1", { method: "PUT", body: JSON.stringify({ name: "NewName" }) });
    const res = await update(req, { params: Promise.resolve({ id: "conv1" }) });
    const data = await res.json();
    expect(data.name).toBe("NewName");
  });

  it("returns 400 when messages is not an array", async () => {
    const req = new NextRequest("http://localhost/api/conversations/conv1", { method: "PUT", body: JSON.stringify({ messages: "not-an-array" }) });
    const res = await update(req, { params: Promise.resolve({ id: "conv1" }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("messages must be an array");
  });

  it("returns 400 when name is empty", async () => {
    const req = new NextRequest("http://localhost/api/conversations/conv1", { method: "PUT", body: JSON.stringify({ name: "  " }) });
    const res = await update(req, { params: Promise.resolve({ id: "conv1" }) });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("name must be a non-empty string");
  });

  it("returns 400 with no update fields", async () => {
    const req = new NextRequest("http://localhost/api/conversations/conv1", { method: "PUT", body: JSON.stringify({}) });
    const res = await update(req, { params: Promise.resolve({ id: "conv1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when conversation not found", async () => {
    mockUpdate.mockImplementation(() => { throw new Error("Conversation \"x\" not found"); });
    const req = new NextRequest("http://localhost/api/conversations/x", { method: "PUT", body: JSON.stringify({ messages: [] }) });
    const res = await update(req, { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/conversations/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a conversation and cleans vector store", async () => {
    mockGet.mockReturnValue({ id: "abc", uploadedFiles: [] } as never);
    mockDelete.mockReturnValue(undefined);
    mockRemoveEntries.mockReturnValue(0);
    const req = new NextRequest("http://localhost/api/conversations/abc", { method: "DELETE" });
    const res = await remove(req, { params: Promise.resolve({ id: "abc" }) });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockGet).toHaveBeenCalledWith("abc");
    expect(mockDelete).toHaveBeenCalledWith("abc");
    expect(mockRemoveEntries).toHaveBeenCalledWith("abc");
  });

  it("cleans up uploaded files from disk", async () => {
    mockGet.mockReturnValue({ id: "abc", uploadedFiles: ["doc.pdf", "readme.md"] } as never);
    (mockFs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockDelete.mockReturnValue(undefined);
    mockRemoveEntries.mockReturnValue(5);
    const req = new NextRequest("http://localhost/api/conversations/abc", { method: "DELETE" });
    const res = await remove(req, { params: Promise.resolve({ id: "abc" }) });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockFs.unlinkSync).toHaveBeenCalledTimes(2);
  });

  it("skips file cleanup when conversation has no uploadedFiles", async () => {
    mockGet.mockReturnValue({ id: "abc", uploadedFiles: undefined } as never);
    mockDelete.mockReturnValue(undefined);
    mockRemoveEntries.mockReturnValue(0);
    const req = new NextRequest("http://localhost/api/conversations/abc", { method: "DELETE" });
    const res = await remove(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    expect(mockFs.unlinkSync).not.toHaveBeenCalled();
  });

  it("returns 404 when conversation not found", async () => {
    mockGet.mockReturnValue(null);
    mockDelete.mockImplementation(() => { throw new Error("Conversation \"x\" not found"); });
    const req = new NextRequest("http://localhost/api/conversations/x", { method: "DELETE" });
    const res = await remove(req, { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });
});
