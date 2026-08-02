/** @vitest-environment node */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { removeEntriesByFilename } from "@/lib/vectorStore";
import fs from "node:fs";

vi.mock("@/lib/vectorStore");
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => "[]"),
  },
}));

const { DELETE: removeFile } = await import("@/app/api/conversations/[id]/files/route");

const mockRemove = vi.mocked(removeEntriesByFilename);
const mockFs = vi.mocked(fs);

describe("DELETE /api/conversations/[id]/files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when filename is missing", async () => {
    const req = new NextRequest("http://localhost/api/conversations/abc/files");
    const res = await removeFile(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("filename");
  });

  it("removes vector entries and deletes raw file", async () => {
    mockRemove.mockReturnValue(3);
    (mockFs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const req = new NextRequest("http://localhost/api/conversations/abc/files?filename=doc.pdf");
    const res = await removeFile(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.removed).toBe(3);
    expect(mockRemove).toHaveBeenCalledWith("abc", "doc.pdf");
    expect(mockFs.unlinkSync).toHaveBeenCalled();
  });

  it("skips file deletion when raw file does not exist", async () => {
    mockRemove.mockReturnValue(0);
    (mockFs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/conversations/abc/files?filename=nonexistent.txt");
    const res = await removeFile(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    expect(mockFs.unlinkSync).not.toHaveBeenCalled();
  });

  it("handles URL-encoded filenames", async () => {
    mockRemove.mockReturnValue(1);
    (mockFs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const req = new NextRequest("http://localhost/api/conversations/abc/files?filename=my%20doc.pdf");
    const res = await removeFile(req, { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    expect(mockRemove).toHaveBeenCalledWith("abc", "my doc.pdf");
  });
});
