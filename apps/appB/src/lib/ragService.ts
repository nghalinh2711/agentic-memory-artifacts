import OpenAI from "openai";
import type { EmbeddingVector, SearchResult } from "./types";
import { getSourceFilenames } from "./vectorStore";

const CHAT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a document-based assistant. Your answers must be grounded in the provided document context. You may summarize, compare, and synthesize information from the documents to form your response. If the provided context does not contain the information needed to answer the question, explain that the available documents don't cover this topic. Mention which documents are available and what they appear to contain. Do not introduce facts, knowledge, or opinions from outside the provided context.`;

export interface RAGDependencies {
  generateEmbedding: (text: string) => Promise<EmbeddingVector>;
  search: (queryEmbedding: EmbeddingVector, conversationId: string, topK: number) => SearchResult[];
  createOpenAIClient: () => OpenAI;
}

export interface RAGQueryInput {
  query: string;
  conversationId: string;
  topK?: number;
}

export interface RAGQueryOutput {
  answer: string;
  sources: SearchResult[];
}

function buildContext(query: string, conversationId: string, sources: SearchResult[]): string {
  if (sources.length === 0) {
    const filenames = getSourceFilenames(conversationId);
    if (filenames.length === 0) {
      return "No documents have been uploaded yet.";
    }
    return `The available documents are: ${filenames.join(", ")}. No chunks matched the query "${query}" closely enough. If the answer cannot be found in these documents, explain what they contain and that the requested information is not present.`;
  }
  return sources
    .map((r, i) => `[Source ${i + 1}: ${r.chunk.metadata.sourceFilename}]\n${r.chunk.text}`)
    .join("\n\n");
}

export async function queryRAG(
  input: RAGQueryInput,
  deps: RAGDependencies,
): Promise<RAGQueryOutput> {
  const topK = input.topK ?? 5;
  const queryEmbedding = await deps.generateEmbedding(input.query);
  const sources = deps.search(queryEmbedding, input.conversationId, topK);
  const context = buildContext(input.query, input.conversationId, sources);
  const client = deps.createOpenAIClient();
  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${input.query}` },
    ],
  });
  const answer = completion.choices[0]?.message?.content ?? "No response generated.";
  return { answer, sources };
}

export async function* streamRAG(
  input: RAGQueryInput,
  deps: RAGDependencies,
): AsyncGenerator<{ token: string } | { sources: SearchResult[] }, void, undefined> {
  const topK = input.topK ?? 5;
  const queryEmbedding = await deps.generateEmbedding(input.query);
  const sources = deps.search(queryEmbedding, input.conversationId, topK);
  yield { sources };
  const context = buildContext(input.query, input.conversationId, sources);
  const client = deps.createOpenAIClient();
  const stream = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Context:\n${context}\n\nQuestion: ${input.query}` },
    ],
    stream: true,
  });
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content;
    if (token) yield { token };
  }
}


