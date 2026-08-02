import { Chunk, ChunkMetadata } from "./types";

const CHARS_PER_TOKEN = 4;
const MIN_CHUNK_TOKENS = 500;
const MAX_CHUNK_TOKENS = 1000;
const OVERLAP_TOKENS = 100;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function buildChunks(paragraphs: string[], sourceFilename: string): Chunk[] {
  const rawChunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const combined = current ? current + "\n\n" + para : para;
    if (estimateTokens(combined) <= MAX_CHUNK_TOKENS) {
      current = combined;
      continue;
    }
    if (current) rawChunks.push(current);
    current = para;
  }
  if (current) rawChunks.push(current);
  return rawChunks.map((text, index) => ({
    text,
    metadata: { sourceFilename, chunkIndex: index, totalChunks: rawChunks.length },
  }));
}

export function chunkText(text: string, sourceFilename: string): Chunk[] {
  if (!text.trim()) return [];
  const paragraphs = splitParagraphs(text);
  return buildChunks(paragraphs, sourceFilename);
}
