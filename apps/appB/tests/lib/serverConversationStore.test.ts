/**
 * @vitest-environment node
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createConversation,
  getConversation,
  getAllConversations,
  updateConversation,
  deleteConversation,
} from "@/lib/serverConversationStore";

const DATA_DIR = path.join(process.cwd(), "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

function cleanDataDir() {
  if (fs.existsSync(CONVERSATIONS_FILE)) {
    fs.unlinkSync(CONVERSATIONS_FILE);
  }
}

describe("serverConversationStore (file-based)", () => {
  beforeEach(() => {
    cleanDataDir();
  });

  afterEach(() => {
    cleanDataDir();
  });

  describe("createConversation", () => {
    it("creates a conversation and persists to disk", () => {
      const conv = createConversation("my-collection");
      expect(conv.collectionName).toBe("my-collection");
      expect(conv.name).toBe("my-collection");
      expect(conv.uploadedFiles).toEqual([]);
      expect(conv.messages).toEqual([]);
      expect(conv.id).toBeTruthy();
      expect(conv.createdAt).toBeTruthy();
      expect(conv.updatedAt).toBeTruthy();
      expect(fs.existsSync(CONVERSATIONS_FILE)).toBe(true);
    });

    it("assigns unique IDs", () => {
      const a = createConversation("a");
      const b = createConversation("b");
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("getConversation", () => {
    it("returns null for non-existent ID", () => {
      expect(getConversation("nonexistent")).toBeNull();
    });

    it("returns conversation by ID", () => {
      const conv = createConversation("docs");
      const found = getConversation(conv.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(conv.id);
    });
  });

  describe("getAllConversations", () => {
    it("returns empty array when no conversations", () => {
      expect(getAllConversations()).toEqual([]);
    });

    it("returns conversations sorted by updatedAt descending", async () => {
      const a = createConversation("a");
      await new Promise((r) => setTimeout(r, 10));
      const b = createConversation("b");
      const all = getAllConversations();
      expect(all).toHaveLength(2);
      // Most recently created should be first
      expect(all[0].id).toBe(b.id);
    });
  });

  describe("updateConversation", () => {
    it("updates messages", () => {
      const conv = createConversation("docs");
      const updated = updateConversation(conv.id, {
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0].content).toBe("Hello");
    });

    it("updates name", () => {
      const conv = createConversation("docs");
      const updated = updateConversation(conv.id, { name: "Renamed" });
      expect(updated.name).toBe("Renamed");
    });

    it("updates uploadedFiles", () => {
      const conv = createConversation("docs");
      const updated = updateConversation(conv.id, { uploadedFiles: ["a.pdf"] });
      expect(updated.uploadedFiles).toEqual(["a.pdf"]);
    });

    it("throws for non-existent conversation", () => {
      expect(() => updateConversation("x", { messages: [] })).toThrow(/not found/);
    });

    it("updates updatedAt timestamp", async () => {
      const conv = createConversation("docs");
      const original = conv.updatedAt;
      await new Promise((r) => setTimeout(r, 10));
      const updated = updateConversation(conv.id, { messages: [{ role: "user", content: "Hi" }] });
      expect(updated.updatedAt).not.toBe(original);
    });
  });

  describe("deleteConversation", () => {
    it("removes a conversation", () => {
      const conv = createConversation("docs");
      deleteConversation(conv.id);
      expect(getConversation(conv.id)).toBeNull();
    });

    it("throws for non-existent conversation", () => {
      expect(() => deleteConversation("x")).toThrow(/not found/);
    });
  });

  describe("persistence", () => {
    it("survives across reads", () => {
      createConversation("persist");
      const all = getAllConversations();
      expect(all).toHaveLength(1);
      const reloaded = JSON.parse(fs.readFileSync(CONVERSATIONS_FILE, "utf-8"));
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].collectionName).toBe("persist");
    });
  });
});
