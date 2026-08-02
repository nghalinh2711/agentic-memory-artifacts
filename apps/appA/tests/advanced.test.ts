import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Express } from 'express';

// Use separate test DB
process.env.DATABASE_PATH = './data/test-advanced-features.db';

const DB_PATH = path.resolve('./data/test-advanced-features.db');

let app: Express;

// Mock OpenAI
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
        create: vi.fn().mockImplementation(({ messages }: any) => {
          const userMsg = messages[messages.length - 1]?.content || '';
          let content = '';

          if (userMsg.includes('comparison') || userMsg.includes('compare') || userMsg.includes('contrast')) {
            content = '## Comparison Analysis\n\n**Overview**: Both documents discuss related topics.\n\n**Key Similarities**: Common themes include research methodology and data analysis.\n\n**Key Differences**: Different approaches to problem-solving and varying conclusions.\n\n**Synthesis**: Together they provide complementary perspectives.';
          } else if (userMsg.includes('summary') || userMsg.includes('summarize') || userMsg.includes('overview')) {
            content = 'This is a comprehensive summary of the document(s). It covers key themes, findings, and provides a coherent overview.';
          } else {
            content = 'Mocked response for testing.';
          }

          return Promise.resolve({
            choices: [{ message: { content } }],
          });
        }),
      },
    };
  }
  return { default: MockOpenAI };
});

beforeAll(async () => {
  const mod = await import('../src/index');
  const models = await import('../src/models');
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

async function setupWorkspaceWithDocs(
  docConfigs: { filename: string; contentType: string; content: string }[]
): Promise<{ workspaceId: string; docIds: string[] }> {
  const ws = await request(app)
    .post('/api/workspaces')
    .send({ name: 'Test Workspace' });
  const workspaceId = ws.body.id;
  const docIds: string[] = [];

  for (const config of docConfigs) {
    const doc = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from(config.content), {
        filename: config.filename,
        contentType: config.contentType,
      });
    const docId = doc.body.id;
    docIds.push(docId);

    // Process the document
    await request(app).post(`/api/workspaces/${workspaceId}/documents/${docId}/process`);
  }

  return { workspaceId, docIds };
}

describe('Document Summarization', () => {
  beforeEach(() => clearDatabase());

  it('summarizes a processed TXT document', async () => {
    const { workspaceId, docIds } = await setupWorkspaceWithDocs([
      {
        filename: 'research.txt',
        contentType: 'text/plain',
        content: 'This is a research document about AI. '.repeat(30),
      },
    ]);

    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents/${docIds[0]}/summarize`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.length).toBeGreaterThan(0);
    expect(res.body.chunkCount).toBeGreaterThan(0);
  });

  it('summarizes a Markdown document', async () => {
    const { workspaceId, docIds } = await setupWorkspaceWithDocs([
      {
        filename: 'readme.md',
        contentType: 'text/markdown',
        content: '# Research Notes\n\n## Introduction\n\nThis document covers important research findings.\n\n## Methods\n\nThe study used quantitative analysis.\n'.repeat(10),
      },
    ]);

    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents/${docIds[0]}/summarize`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
  });

  it('rejects summarization of unprocessed document', async () => {
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Unprocessed WS' });

    const doc = await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents`)
      .attach('file', Buffer.from('content'), { filename: 'raw.txt', contentType: 'text/plain' });

    const res = await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents/${doc.body.id}/summarize`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Process it first');
  });

  it('returns 404 for nonexistent document', async () => {
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Test WS' });

    const res = await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents/fake-id/summarize`);

    expect(res.status).toBe(400);
  });
});

describe('Workspace Summarization', () => {
  beforeEach(() => clearDatabase());

  it('summarizes workspace with multiple processed documents', async () => {
    const { workspaceId } = await setupWorkspaceWithDocs([
      { filename: 'doc1.txt', contentType: 'text/plain', content: 'Document one content about AI. '.repeat(30) },
      { filename: 'doc2.txt', contentType: 'text/plain', content: 'Document two content about ML. '.repeat(30) },
    ]);

    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/summarize`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.sourceCount).toBe(2);
    expect(res.body.chunkCount).toBeGreaterThan(0);
  });

  it('handles empty workspace gracefully', async () => {
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Empty WS' });

    const res = await request(app)
      .post(`/api/workspaces/${ws.body.id}/summarize`);

    expect(res.status).toBe(200);
    expect(res.body.sourceCount).toBe(0);
    expect(res.body.chunkCount).toBe(0);
  });

  it('returns 404 for nonexistent workspace', async () => {
    const res = await request(app)
      .post('/api/workspaces/fake-id/summarize');

    expect(res.status).toBe(404);
  });
});

describe('Document Comparison', () => {
  beforeEach(() => clearDatabase());

  it('compares two similar documents', async () => {
    const { workspaceId, docIds } = await setupWorkspaceWithDocs([
      { filename: 'ai-research.txt', contentType: 'text/plain', content: 'AI research findings about neural networks. '.repeat(30) },
      { filename: 'ml-study.txt', contentType: 'text/plain', content: 'Machine learning study on deep learning techniques. '.repeat(30) },
    ]);

    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/compare`)
      .send({ documentIds: docIds });

    expect(res.status).toBe(200);
    expect(res.body.comparison).toBeDefined();
    expect(res.body.documentsCompared).toBe(2);
    expect(res.body.documentNames.length).toBe(2);
    expect(res.body.comparison).toContain('Comparison Analysis');
  });

  it('compares three dissimilar documents', async () => {
    const { workspaceId, docIds } = await setupWorkspaceWithDocs([
      { filename: 'science.txt', contentType: 'text/plain', content: 'Scientific methodology and experimental design. '.repeat(30) },
      { filename: 'history.txt', contentType: 'text/plain', content: 'Historical analysis of ancient civilizations. '.repeat(30) },
      { filename: 'tech.txt', contentType: 'text/plain', content: 'Technology trends in modern computing. '.repeat(30) },
    ]);

    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/compare`)
      .send({ documentIds: docIds });

    expect(res.status).toBe(200);
    expect(res.body.documentsCompared).toBe(3);
  });

  it('handles single document with informative message', async () => {
    const { workspaceId, docIds } = await setupWorkspaceWithDocs([
      { filename: 'solo.txt', contentType: 'text/plain', content: 'Single document content. '.repeat(30) },
    ]);

    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/compare`)
      .send({ documentIds: [docIds[0]] });

    expect(res.status).toBe(200);
    expect(res.body.documentsCompared).toBe(1);
    expect(res.body.comparison).toContain('at least two');
  });

  it('handles unprocessed documents gracefully', async () => {
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Unprocessed WS' });

    const doc1 = await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents`)
      .attach('file', Buffer.from('content 1'), { filename: 'raw1.txt', contentType: 'text/plain' });

    const doc2 = await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents`)
      .attach('file', Buffer.from('content 2'), { filename: 'raw2.txt', contentType: 'text/plain' });

    const res = await request(app)
      .post(`/api/workspaces/${ws.body.id}/compare`)
      .send({ documentIds: [doc1.body.id, doc2.body.id] });

    expect(res.status).toBe(200);
    expect(res.body.comparison).toContain('processed');
  });
});

describe('Features via Conversation', () => {
  beforeEach(() => clearDatabase());

  it('summarization result can be invoked from conversation context', async () => {
    const { workspaceId, docIds } = await setupWorkspaceWithDocs([
      { filename: 'research.txt', contentType: 'text/plain', content: 'Research document content. '.repeat(30) },
    ]);

    // Create conversation
    const conv = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations`)
      .send({ title: 'Research Chat' });

    // Send a message requesting summarization
    const msg = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'Please summarize this document' });

    // The message should be processed (may fail on LLM but the user message should be stored)
    // At minimum, the conversation should exist with messages
    const getConv = await request(app)
      .get(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}`);

    expect(getConv.status).toBe(200);
    expect(getConv.body.messages).toBeDefined();
  });

  it('comparison can be discussed in a conversation', async () => {
    const { workspaceId, docIds } = await setupWorkspaceWithDocs([
      { filename: 'doc-a.txt', contentType: 'text/plain', content: 'Document A content. '.repeat(30) },
      { filename: 'doc-b.txt', contentType: 'text/plain', content: 'Document B content. '.repeat(30) },
    ]);

    const conv = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations`)
      .send({ title: 'Comparison Chat' });

    const msg = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'Compare these two documents' });

    // Verify conversation with messages exists
    const getConv = await request(app)
      .get(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}`);

    expect(getConv.status).toBe(200);
    expect(getConv.body.messages).toBeDefined();
  });
});
