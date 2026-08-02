import OpenAI from "openai";
import type { EmbeddingVector } from "./types";

const EMBEDDING_MODEL = "text-embedding-3-small";

function createClient(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export async function generateEmbedding(text: string): Promise<EmbeddingVector> {
  const client = createClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[],
): Promise<EmbeddingVector[]> {
  const client = createClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

export function computeSimilarity(
  query: EmbeddingVector,
  candidates: EmbeddingVector[],
): number[] {
  return candidates.map((c) => cosineSimilarity(query, c));
}
