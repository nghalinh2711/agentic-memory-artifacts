import OpenAI from 'openai';
import { config } from '../config';
import { embeddingService } from './embeddingService';
import { vectorStore } from './vectorStore';
import db from '../models/database';
import type { SourceReference } from '../models/types';

interface RetrievedChunk {
  id: string;
  document: string;
  metadata: Record<string, string>;
  distance: number;
  content: string;
}

interface QueryResult {
  answer: string;
  sources: SourceReference[];
  retrievedChunks: number;
}

export class RagQueryEngine {
  private llmClient: OpenAI;
  private model: string;

  constructor() {
    this.llmClient = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = config.openai.model;
  }

  /**
   * Execute a RAG query against a workspace
   */
  async query(
    question: string,
    workspaceId: string,
    topK: number = 5
  ): Promise<QueryResult> {
    // Retrieve relevant context and sources
    const { context, sources } = await this.retrieveContext(question, workspaceId, topK);

    // Generate answer with LLM
    const answer = await this.generateAnswer(question, context);

    return {
      answer,
      sources,
      retrievedChunks: sources.length,
    };
  }

  /**
   * Search the vector store for relevant chunks
   */
  private async searchVectorStore(
    queryEmbedding: number[],
    workspaceId: string,
    topK: number
  ): Promise<RetrievedChunk[]> {
    const results = await vectorStore.queryEmbeddings(queryEmbedding, topK);

    return results
      .filter((r) => r.metadata.workspace_id === workspaceId)
      .map((r) => ({
        id: r.id,
        document: r.document,
        metadata: r.metadata,
        distance: r.distance,
        content: r.document,
      }));
  }

  /**
   * Fallback search: scan all chunks in the workspace via SQLite
   * In production, this would be replaced by proper vector search
   */
  private searchLocal(
    _queryEmbedding: number[],
    workspaceId: string,
    topK: number
  ): RetrievedChunk[] {
    // Get all chunks from documents in this workspace (any status — chunks exist regardless of doc status)
    const chunks = db
      .prepare(
        `SELECT c.id, c.content, c.chunk_index, c.metadata, d.original_name as document_name, d.id as document_id
         FROM chunks c
         JOIN documents d ON c.document_id = d.id
         WHERE d.workspace_id = ?
         ORDER BY c.created_at DESC
         LIMIT ?`
      )
      .all(workspaceId, topK) as any[];

    return chunks.map((chunk) => ({
      id: chunk.id,
      document: chunk.content,
      metadata: {
        document_name: chunk.document_name || 'Unknown',
        document_id: chunk.document_id,
        chunk_index: String(chunk.chunk_index || 0),
        workspace_id: workspaceId,
      },
      distance: 0.5,
      content: chunk.content,
    }));
  }

  /**
   * Build context string from retrieved chunks
   */
  private buildContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) return 'No relevant documents found.';

    return chunks
      .map(
        (chunk, i) =>
          `[Source ${i + 1}: ${chunk.metadata.document_name}, Section ${chunk.metadata.chunk_index}]\n${chunk.content}`
      )
      .join('\n\n---\n\n');
  }

  /**
   * Retrieve relevant chunks and build context (shared between query and queryStream)
   */
  async retrieveContext(
    question: string,
    workspaceId: string,
    topK: number = 5
  ): Promise<{ context: string; sources: SourceReference[] }> {
    const queryEmbedding = await embeddingService.embedText(question);

    let retrievedChunks: RetrievedChunk[];

    if (vectorStore.isAvailable()) {
      retrievedChunks = await this.searchVectorStore(queryEmbedding, workspaceId, topK);
    } else {
      retrievedChunks = this.searchLocal(queryEmbedding, workspaceId, topK);
    }

    const context = this.buildContext(retrievedChunks);

    const sources: SourceReference[] = retrievedChunks.map((chunk) => ({
      document_name: chunk.metadata.document_name || 'Unknown',
      chunk_index: parseInt(chunk.metadata.chunk_index || '0', 10),
      content_snippet: chunk.content.substring(0, 200) + '...',
      relevance_score: 1 - Math.min(chunk.distance, 1),
    }));

    return { context, sources };
  }

  /**
   * Stream an answer using LLM with RAG context.
   * Returns an async iterable of content deltas.
   */
  async *queryStream(
    question: string,
    workspaceId: string,
    topK: number = 5
  ): AsyncGenerator<{ token: string } | { sources: SourceReference[]; done: true }> {
    const { context, sources } = await this.retrieveContext(question, workspaceId, topK);

    const systemPrompt = `You are a research assistant powered by Retrieval-Augmented Generation (RAG).
Answer the user's question based ONLY on the provided context below.
If the context doesn't contain enough information to answer, say so clearly.
Always cite which source documents/sections you used in your answer.

Context:
${context}`;

    const stream = await this.llmClient.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { token: delta };
      }
    }

    yield { sources, done: true };
  }

  /**
   * Generate answer using LLM with RAG context
   */
  private async generateAnswer(question: string, context: string): Promise<string> {
    const systemPrompt = `You are a research assistant powered by Retrieval-Augmented Generation (RAG).
Answer the user's question based ONLY on the provided context below.
If the context doesn't contain enough information to answer, say so clearly.
Always cite which source documents/sections you used in your answer.

Context:
${context}`;

    const response = await this.llmClient.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'No answer generated.';
  }
}

export const ragQueryEngine = new RagQueryEngine();
