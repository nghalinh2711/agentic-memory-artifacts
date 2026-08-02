import type {
  Collection,
  CollectionManager,
  DocumentEntry,
} from "./types";

const STORAGE_KEY = "ai-chatbot-collections";

function loadFromStorage(): Map<string, Collection> {
  if (typeof localStorage === "undefined") return new Map();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return new Map();
  const parsed: [string, Collection][] = JSON.parse(raw);
  return new Map(parsed);
}

function saveToStorage(collections: Map<string, Collection>): void {
  if (typeof localStorage === "undefined") return;
  const data = JSON.stringify([...collections]);
  localStorage.setItem(STORAGE_KEY, data);
}

class CollectionManagerImpl implements CollectionManager {
  private collections: Map<string, Collection>;

  constructor() {
    this.collections = loadFromStorage();
  }

  createCollection(name: string): Collection {
    const existing = this.collections.get(name);
    if (existing) throw new Error(`Collection "${name}" already exists`);
    const collection: Collection = {
      name,
      documents: [],
      createdAt: new Date().toISOString(),
    };
    this.collections.set(name, collection);
    saveToStorage(this.collections);
    return collection;
  }

  deleteCollection(name: string): void {
    if (!this.collections.has(name)) {
      throw new Error(`Collection "${name}" not found`);
    }
    this.collections.delete(name);
    saveToStorage(this.collections);
  }

  getCollection(name: string): Collection | null {
    return this.collections.get(name) ?? null;
  }

  getAllCollections(): Collection[] {
    return [...this.collections.values()];
  }

  addDocument(collectionName: string, document: DocumentEntry): void {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection "${collectionName}" not found`);
    }
    collection.documents.push(document);
    saveToStorage(this.collections);
  }

  removeDocument(collectionName: string, filename: string): void {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection "${collectionName}" not found`);
    }
    collection.documents = collection.documents.filter(
      (d) => d.filename !== filename,
    );
    saveToStorage(this.collections);
  }
}

export function createCollectionManager(): CollectionManager {
  return new CollectionManagerImpl();
}
