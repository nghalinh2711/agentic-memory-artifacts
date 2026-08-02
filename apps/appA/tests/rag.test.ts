import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Express } from 'express';

// Must set before module imports to use a separate test DB
process.env.DATABASE_PATH = './data/test-rag-pipeline.db';

const DB_PATH = path.resolve('./data/test-rag-pipeline.db');

let app: Express;
let chunkingService: any;

beforeAll(async () => {
  // Dynamic import to respect the env var set above
  const mod = await import('../src/index');
  const models = await import('../src/models');
  const services = await import('../src/services/chunkingService');
  chunkingService = services.chunkingService;
  models.initializeDatabase();
  app = mod.createApp();
});

afterAll(() => {
  if (fs.existsSync(DB_PATH)) {
    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
    const tables = ['embeddings', 'chunks', 'messages', 'conversations', 'documents', 'workspaces'];
    for (const table of tables) {
      try { db.exec(`DELETE FROM ${table}`); } catch {}
    }
    db.close();
  }
});

function clearDatabase() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  const tables = ['embeddings', 'chunks', 'messages', 'conversations', 'documents', 'workspaces'];
  for (const table of tables) {
    try { db.exec(`DELETE FROM ${table}`); } catch {}
  }
  db.close();
}

// Mock OpenAI to avoid real API calls
vi.mock('openai', () => {
  class MockOpenAI {
    embeddings = {
      create: vi.fn().mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          embedding: Array.from({ length: 256 }, () => Math.random()),
        })),
      }),
    };
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'RAG (Retrieval-Augmented Generation) combines retrieval-based and generation-based AI to produce grounded, factual answers.',
              },
            },
          ],
        }),
      },
    };
  }

  return { default: MockOpenAI };
});

describe('Chunking Service', () => {
  it('splits text into chunks by paragraph boundaries', () => {
    const text = [
      'This is the first paragraph with enough content to make a chunk.',
      'This is the second paragraph that continues the document.',
      'This is the third paragraph with additional information.',
    ].join('\n\n');

    const chunks = chunkingService.splitText(text, 'doc-1', { source: 'test' });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].documentId).toBe('doc-1');
    expect(chunks[0].metadata.source).toBe('test');
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('preserves semantic boundaries (paragraphs)', () => {
    const text = [
      'Paragraph one about topic A. '.repeat(50),
      'Paragraph two about topic B. '.repeat(50),
      'Paragraph three about topic C. '.repeat(50),
    ].join('\n\n');

    const chunks = chunkingService.splitText(text, 'doc-2');
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Chunks should not split in the middle of paragraphs
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it('creates appropriate overlap between chunks', () => {
    // Generate text that will create multiple chunks
    const text = Array.from({ length: 20 }, (_, i) =>
      `Paragraph ${i + 1}: `.repeat(1) + `Content for paragraph ${i + 1}. `.repeat(20)
    ).join('\n\n');

    const chunks = chunkingService.splitText(text, 'doc-3');
    if (chunks.length > 1) {
      // Check that consecutive chunks have some overlap
      const firstEnd = chunks[0].content.slice(-100);
      const secondStart = chunks[1].content.slice(0, 100);
      // Overlap should share some words
      const firstWords = new Set(firstEnd.split(/\s+/));
      const secondWords = secondStart.split(/\s+/);
      const overlap = secondWords.filter((w) => firstWords.has(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });

  it('handles empty text', () => {
    const chunks = chunkingService.splitText('', 'doc-empty');
    expect(chunks.length).toBe(0);
  });

  it('handles single paragraph', () => {
    const text = 'A single short paragraph.';
    const chunks = chunkingService.splitText(text, 'doc-single');
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(text);
  });
});

describe('RAG Query Pipeline', () => {
  let workspaceId: string;

  beforeEach(async () => {
    clearDatabase();
    // Create workspace
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'RAG Test Workspace' });
    workspaceId = ws.body.id;

    // Upload and process a document
    const text = [
      'Retrieval-Augmented Generation (RAG) is a technique for enhancing LLM outputs.',
      'RAG works by retrieving relevant documents before generating responses.',
      'The key benefit of RAG is reducing hallucinations in AI-generated content.',
      'Vector databases store document embeddings for efficient similarity search.',
      'Embedding models convert text into dense vector representations.',
    ].join('\n\n');

    const doc = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from(text), { filename: 'rag-overview.txt', contentType: 'text/plain' });

    const docId = doc.body.id;

    // Process document (embeddings are mocked so this should succeed)
    await request(app)
      .post(`/api/workspaces/${workspaceId}/documents/${docId}/process`);
  });

  it('returns answer with source citations for valid query', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/query`)
      .send({ question: 'What is RAG?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.answer.length).toBeGreaterThan(0);
    expect(res.body.sources).toBeDefined();
    expect(res.body.retrievedChunks).toBeGreaterThan(0);

    // Check source format
    if (res.body.sources.length > 0) {
      const source = res.body.sources[0];
      expect(source.document_name).toBeDefined();
      expect(source.relevance_score).toBeDefined();
      expect(source.content_snippet).toBeDefined();
    }
  });

  it('rejects query with empty question', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/query`)
      .send({ question: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('rejects query without question field', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/query`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent workspace', async () => {
    const res = await request(app)
      .post('/api/workspaces/nonexistent-id/query')
      .send({ question: 'What is RAG?' });

    expect(res.status).toBe(404);
  });

  it('handles query with empty workspace (no documents)', async () => {
    clearDatabase();
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Empty Workspace' });

    const res = await request(app)
      .post(`/api/workspaces/${ws.body.id}/query`)
      .send({ question: 'What is RAG?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.retrievedChunks).toBe(0);
  });

  it('respects custom topK parameter', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/query`)
      .send({ question: 'How does RAG work?', topK: 2 });

    expect(res.status).toBe(200);
    expect(res.body.retrievedChunks).toBeLessThanOrEqual(2);
  });
});

describe('RAG Pipeline Edge Cases', () => {
  let workspaceId: string;
  let docId: string;

  beforeEach(async () => {
    clearDatabase();
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Edge Case WS' });
    workspaceId = ws.body.id;

    const text = 'RAG stands for Retrieval-Augmented Generation. It combines information retrieval with text generation.';
    const doc = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from(text), { filename: 'simple.txt', contentType: 'text/plain' });
    docId = doc.body.id;

    await request(app)
      .post(`/api/workspaces/${workspaceId}/documents/${docId}/process`);
  });

  it('handles deleted document referenced by chunks gracefully', async () => {
    // Delete the document
    await request(app).delete(`/api/workspaces/${workspaceId}/documents/${docId}`);

    // Query should not crash
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/query`)
      .send({ question: 'What is RAG?' });

    expect(res.status).toBe(200);
    expect(res.body.retrievedChunks).toBe(0);
  });

  it('handles query when workspace has documents but no processed chunks', async () => {
    clearDatabase();
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Unprocessed WS' });

    // Upload document without processing
    await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents`)
      .attach('file', Buffer.from('Some content'), { filename: 'unprocessed.txt', contentType: 'text/plain' });

    const res = await request(app)
      .post(`/api/workspaces/${ws.body.id}/query`)
      .send({ question: 'What is in the document?' });

    expect(res.status).toBe(200);
  });

  it('handles long questions gracefully', async () => {
    const longQuestion = 'What is RAG? '.repeat(100);
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/query`)
      .send({ question: longQuestion });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
  });
});
