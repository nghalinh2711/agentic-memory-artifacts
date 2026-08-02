import { describe, expect, it, beforeEach } from "vitest";
import { createCollectionManager } from "@/lib/collectionManager";
import type { CollectionManager } from "@/lib/types";

describe("CollectionManager", () => {
  let manager: CollectionManager;

  beforeEach(() => {
    localStorage.clear();
    manager = createCollectionManager();
  });

  describe("createCollection", () => {
    it("creates a new collection with empty documents", () => {
      const col = manager.createCollection("my-docs");
      expect(col.name).toBe("my-docs");
      expect(col.documents).toEqual([]);
      expect(col.createdAt).toBeTruthy();
    });

    it("throws on duplicate collection name", () => {
      manager.createCollection("my-docs");
      expect(() => manager.createCollection("my-docs")).toThrow(
        /already exists/,
      );
    });

    it("persists across manager instances", () => {
      manager.createCollection("persist-test");
      const manager2 = createCollectionManager();
      const col = manager2.getCollection("persist-test");
      expect(col).not.toBeNull();
      expect(col!.name).toBe("persist-test");
    });
  });

  describe("deleteCollection", () => {
    it("removes an existing collection", () => {
      manager.createCollection("to-delete");
      manager.deleteCollection("to-delete");
      expect(manager.getCollection("to-delete")).toBeNull();
    });

    it("throws when deleting non-existent collection", () => {
      expect(() => manager.deleteCollection("nonexistent")).toThrow(
        /not found/,
      );
    });

    it("allows deletion of collection with documents", () => {
      manager.createCollection("with-docs");
      manager.addDocument("with-docs", {
        filename: "a.pdf",
        uploadedAt: new Date().toISOString(),
      });
      manager.deleteCollection("with-docs");
      expect(manager.getCollection("with-docs")).toBeNull();
    });
  });

  describe("getCollection", () => {
    it("returns null for non-existent collection", () => {
      expect(manager.getCollection("nonexistent")).toBeNull();
    });

    it("returns the collection by name", () => {
      manager.createCollection("test");
      const col = manager.getCollection("test");
      expect(col).not.toBeNull();
      expect(col!.name).toBe("test");
    });
  });

  describe("getAllCollections", () => {
    it("returns empty array when no collections exist", () => {
      expect(manager.getAllCollections()).toEqual([]);
    });

    it("returns all created collections", () => {
      manager.createCollection("a");
      manager.createCollection("b");
      const all = manager.getAllCollections();
      expect(all).toHaveLength(2);
      expect(all.map((c) => c.name).sort()).toEqual(["a", "b"]);
    });
  });

  describe("addDocument", () => {
    it("adds a document to a collection", () => {
      manager.createCollection("docs");
      const doc = { filename: "file.pdf", uploadedAt: "2024-01-01T00:00:00Z" };
      manager.addDocument("docs", doc);
      const col = manager.getCollection("docs");
      expect(col!.documents).toHaveLength(1);
      expect(col!.documents[0].filename).toBe("file.pdf");
    });

    it("throws when adding to non-existent collection", () => {
      expect(() =>
        manager.addDocument("nonexistent", {
          filename: "x.txt",
          uploadedAt: "",
        }),
      ).toThrow(/not found/);
    });

    it("allows multiple documents in same collection", () => {
      manager.createCollection("multi");
      manager.addDocument("multi", {
        filename: "a.pdf",
        uploadedAt: "2024-01-01T00:00:00Z",
      });
      manager.addDocument("multi", {
        filename: "b.txt",
        uploadedAt: "2024-01-02T00:00:00Z",
      });
      const col = manager.getCollection("multi");
      expect(col!.documents).toHaveLength(2);
    });
  });

  describe("removeDocument", () => {
    it("removes a document from a collection by filename", () => {
      manager.createCollection("docs");
      manager.addDocument("docs", {
        filename: "a.pdf",
        uploadedAt: "",
      });
      manager.addDocument("docs", {
        filename: "b.txt",
        uploadedAt: "",
      });
      manager.removeDocument("docs", "a.pdf");
      const col = manager.getCollection("docs");
      expect(col!.documents).toHaveLength(1);
      expect(col!.documents[0].filename).toBe("b.txt");
    });

    it("throws when removing from non-existent collection", () => {
      expect(() => manager.removeDocument("nonexistent", "x.txt")).toThrow(
        /not found/,
      );
    });

    it("does nothing when document not found in collection", () => {
      manager.createCollection("docs");
      manager.addDocument("docs", {
        filename: "a.pdf",
        uploadedAt: "",
      });
      manager.removeDocument("docs", "nonexistent.pdf");
      expect(manager.getCollection("docs")!.documents).toHaveLength(1);
    });
  });

  describe("empty collection handling", () => {
    it("getAllCollections on empty store returns empty array", () => {
      expect(manager.getAllCollections()).toEqual([]);
    });

    it("getCollection on empty store returns null", () => {
      expect(manager.getCollection("anything")).toBeNull();
    });
  });
});
