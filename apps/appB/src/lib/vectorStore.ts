import fs from "node:fs";
import path from "node:path";
import type { Chunk, EmbeddingVector, VectorStoreEntry, SearchResult } from "./types";
import { computeSimilarity } from "./embeddingService";

const DATA_DIR = path.join(process.cwd(), "data");
const EMBEDDINGS_FILE = path.join(DATA_DIR, "embeddings.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): VectorStoreEntry[] {
  ensureDataDir();
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    fs.writeFileSync(EMBEDDINGS_FILE, "[]", "utf-8");
    return [];
  }
  const raw = fs.readFileSync(EMBEDDINGS_FILE, "utf-8");
  return JSON.parse(raw) as VectorStoreEntry[];
}

function saveStore(entries: VectorStoreEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(entries), "utf-8");
}

let store: VectorStoreEntry[] = loadStore();

export function addEntry(entry: VectorStoreEntry): void {
  store.push(entry);
  saveStore(store);
}

export function addEntries(entries: VectorStoreEntry[]): void {
  store.push(...entries);
  saveStore(store);
}

export function getAllEntries(): VectorStoreEntry[] {
  return [...store];
}

export function getEntryCount(): number {
  return store.length;
}

export function clearStore(): void {
  store = [];
  saveStore(store);
}

export function getSourceFilenames(conversationId: string): string[] {
  const names = new Set<string>();
  for (const entry of store) {
    if (entry.conversationId === conversationId) {
      names.add(entry.chunk.metadata.sourceFilename);
    }
  }
  return [...names];
}

export function removeEntriesByConversation(conversationId: string): number {
  const before = store.length;
  store = store.filter((e) => e.conversationId !== conversationId);
  saveStore(store);
  return before - store.length;
}

export function removeEntriesByFilename(conversationId: string, filename: string): number {
  const before = store.length;
  store = store.filter(
    (e) => !(e.conversationId === conversationId && e.chunk.metadata.sourceFilename === filename),
  );
  saveStore(store);
  return before - store.length;
}

export function search(
  queryEmbedding: EmbeddingVector,
  conversationId: string,
  topK: number,
): SearchResult[] {
  const scoped = store.filter((e) => e.conversationId === conversationId);
  if (scoped.length === 0) return [];
  const embeddings = scoped.map((e) => e.embedding);
  const scores = computeSimilarity(queryEmbedding, embeddings);
  const indexed = scores.map((score, i) => ({ score, index: i }));
  indexed.sort((a, b) => b.score - a.score);
  return indexed.slice(0, topK).map(({ score, index }) => ({
    chunk: scoped[index].chunk,
    score,
  }));
}

export function searchByChunks(
  queryEmbedding: EmbeddingVector,
  chunks: Chunk[],
  chunkEmbeddings: EmbeddingVector[],
  topK: number,
): SearchResult[] {
  if (chunks.length === 0) return [];
  const scores = computeSimilarity(queryEmbedding, chunkEmbeddings);
  const indexed = scores.map((score, i) => ({ score, index: i }));
  indexed.sort((a, b) => b.score - a.score);
  return indexed.slice(0, topK).map(({ score, index }) => ({
    chunk: chunks[index],
    score,
  }));
}
