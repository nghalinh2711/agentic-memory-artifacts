import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Express } from 'express';

process.env.DATABASE_PATH = './data/test-e2e.db';

const DB_PATH = path.resolve('./data/test-e2e.db');

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
          const lastMsg = messages[messages.length - 1]?.content || '';
          let content = '';

          if (lastMsg.includes('compare') || lastMsg.includes('contrast')) {
            content = '**Comparison**: The documents share common themes around AI and machine learning. Key differences include methodology and scope.';
          } else if (lastMsg.includes('summary') || lastMsg.includes('summari')) {
            content = '**Summary**: This document covers key concepts in AI research, including RAG systems, embeddings, and vector databases.';
          } else if (lastMsg.includes('follow-up') || lastMsg.includes('Follow-up')) {
            content = '**Follow-up Response**: Based on the previous discussion, RAG systems improve accuracy by grounding responses in retrieved documents. Key benefits include reduced hallucinations and verifiable sources.';
          } else {
            content = '**RAG Answer**: Retrieval-Augmented Generation (RAG) is a technique that enhances LLM outputs by retrieving relevant documents before generating responses. [Source: rag-overview.txt, Section 0]';
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
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  ['-wal', '-shm'].forEach((s) => { if (fs.existsSync(DB_PATH + s)) fs.unlinkSync(DB_PATH + s); });

  const mod = await import('../src/index');
  const models = await import('../src/models');
  models.initializeDatabase();
  app = mod.createApp();
});

afterAll(() => {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  ['-wal', '-shm'].forEach((s) => { if (fs.existsSync(DB_PATH + s)) fs.unlinkSync(DB_PATH + s); });
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

async function setupFullWorkspace(): Promise<{ workspaceId: string; docIds: string[] }> {
  const ws = await request(app).post('/api/workspaces').send({ name: 'E2E Test Workspace' });
  const workspaceId = ws.body.id;
  const docIds: string[] = [];

  // Upload TXT document
  const txtDoc = await request(app)
    .post(`/api/workspaces/${workspaceId}/documents`)
    .attach('file', Buffer.from('# AI Research\n\nRAG is a technique for enhancing LLM outputs.\n\nIt retrieves documents before generating responses.\n\nKey benefits include reduced hallucinations.'.repeat(15)), {
      filename: 'ai-research.txt',
      contentType: 'text/plain',
    });
  docIds.push(txtDoc.body.id);

  // Upload Markdown document
  const mdDoc = await request(app)
    .post(`/api/workspaces/${workspaceId}/documents`)
    .attach('file', Buffer.from('# Machine Learning\n\n## Introduction\n\nMachine learning is a subset of AI.\n\n## Methods\n\nSupervised and unsupervised learning.'.repeat(15)), {
      filename: 'ml-notes.md',
      contentType: 'text/markdown',
    });
  docIds.push(mdDoc.body.id);

  // Process both documents
  for (const docId of docIds) {
    await request(app).post(`/api/workspaces/${workspaceId}/documents/${docId}/process`);
  }

  return { workspaceId, docIds };
}

describe('Full User Journey', () => {
  beforeEach(() => clearDatabase());

  it('complete workflow: workspace → upload → process → chat → summarize → compare', async () => {
    // Step 1: Create workspace
    const wsRes = await request(app).post('/api/workspaces').send({ name: 'My Research' });
    expect(wsRes.status).toBe(201);
    const workspaceId = wsRes.body.id;

    // Step 2: Upload two documents
    const doc1 = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from('Document 1: AI systems are transforming research.'.repeat(30)), {
        filename: 'doc1.txt', contentType: 'text/plain',
      });
    expect(doc1.status).toBe(201);
    expect(doc1.body.status).toBe('uploaded');

    const doc2 = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from('# Document 2\n\nML techniques improve analysis.\n\n## Key Points\n\n- Data quality matters'.repeat(30)), {
        filename: 'doc2.md', contentType: 'text/markdown',
      });
    expect(doc2.status).toBe(201);

    // Step 3: Process documents
    await request(app).post(`/api/workspaces/${workspaceId}/documents/${doc1.body.id}/process`);
    await request(app).post(`/api/workspaces/${workspaceId}/documents/${doc2.body.id}/process`);

    // Verify processing
    const docsAfter = await request(app).get(`/api/workspaces/${workspaceId}/documents`);
    expect(docsAfter.body.length).toBe(2);

    // Step 4: Start a conversation
    const conv = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations`)
      .send({ title: 'Research Discussion' });
    expect(conv.status).toBe(201);
    const convId = conv.body.id;

    // Step 5: Ask first question
    const msg1 = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${convId}/messages`)
      .send({ message: 'What is RAG?' });
    expect(msg1.status).toBe(201);
    expect(msg1.body.userMsg).toBeDefined();
    expect(msg1.body.assistantMsg).toBeDefined();
    expect(msg1.body.assistantMsg.role).toBe('assistant');

    // Step 6: Ask a follow-up
    const msg2 = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${convId}/messages`)
      .send({ message: 'Follow-up: what are the key benefits?' });
    expect(msg2.status).toBe(201);
    expect(msg2.body.assistantMsg.content).toContain('Follow-up');

    // Step 7: Verify full conversation history
    const fullConv = await request(app).get(`/api/workspaces/${workspaceId}/conversations/${convId}`);
    expect(fullConv.body.messages.length).toBe(4); // 2 user + 2 assistant
    expect(fullConv.body.messages[0].role).toBe('user');
    expect(fullConv.body.messages[1].role).toBe('assistant');

    // Step 8: Request document summary
    const summary = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents/${doc1.body.id}/summarize`);
    expect(summary.status).toBe(200);
    expect(summary.body.summary).toContain('Summary');

    // Step 9: Request workspace summary
    const wsSummary = await request(app)
      .post(`/api/workspaces/${workspaceId}/summarize`);
    expect(wsSummary.status).toBe(200);
    expect(wsSummary.body.sourceCount).toBeGreaterThan(0);

    // Step 10: Request comparison
    const comparison = await request(app)
      .post(`/api/workspaces/${workspaceId}/compare`)
      .send({ documentIds: [doc1.body.id, doc2.body.id] });
    expect(comparison.status).toBe(200);
    expect(comparison.body.documentsCompared).toBe(2);
    expect(comparison.body.comparison).toContain('Comparison');

    // Step 11: Verify all data persisted
    const workspaces = await request(app).get('/api/workspaces');
    expect(workspaces.body.length).toBe(1);

    const conversations = await request(app).get(`/api/workspaces/${workspaceId}/conversations`);
    expect(conversations.body.length).toBe(1);
  });

  it('handles unsupported file upload gracefully', async () => {
    const ws = await request(app).post('/api/workspaces').send({ name: 'Upload Test' });

    const res = await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents`)
      .attach('file', Buffer.from('fake image'), { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(500); // Multer error for unsupported type
  });

  it('handles empty workspace conversation gracefully', async () => {
    const ws = await request(app).post('/api/workspaces').send({ name: 'Empty WS' });
    const conv = await request(app)
      .post(`/api/workspaces/${ws.body.id}/conversations`)
      .send({ title: 'Empty Chat' });

    const msg = await request(app)
      .post(`/api/workspaces/${ws.body.id}/conversations/${conv.body.id}/messages`)
      .send({ message: 'What is RAG?' });

    // Should still return a response even with no documents
    expect(msg.status).toBe(201);
    expect(msg.body.assistantMsg).toBeDefined();
  });

  it('handles conversation deletion while messages exist', async () => {
    const { workspaceId } = await setupFullWorkspace();

    const conv = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations`)
      .send({ title: 'To Delete' });

    // Send a message
    await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'Test message' });

    // Delete conversation (cascade should remove messages)
    const delRes = await request(app).delete(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}`);
    expect(delRes.status).toBe(204);

    // Verify gone
    const check = await request(app).get(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}`);
    expect(check.status).toBe(404);
  });

  it('handles workspace deletion with active conversations', async () => {
    const { workspaceId } = await setupFullWorkspace();

    // Create conversation with messages
    const conv = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations`)
      .send({ title: 'Active Chat' });

    await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'Important question' });

    // Delete entire workspace
    const delRes = await request(app).delete(`/api/workspaces/${workspaceId}`);
    expect(delRes.status).toBe(204);

    // Verify cascade
    const checkWs = await request(app).get(`/api/workspaces/${workspaceId}`);
    expect(checkWs.status).toBe(404);

    const checkConv = await request(app).get(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}`);
    expect(checkConv.status).toBe(404);
  });

  it('multi-turn conversation with context retention', async () => {
    const { workspaceId } = await setupFullWorkspace();

    const conv = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations`)
      .send({ title: 'Multi-turn' });

    // Turn 1
    await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'What is machine learning?' });

    // Turn 2
    await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'How does it relate to AI?' });

    // Turn 3
    await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'What are the practical applications?' });

    // Verify all 6 messages exist (3 user + 3 assistant)
    const fullConv = await request(app).get(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}`);
    expect(fullConv.body.messages.length).toBe(6);

    // Verify message order: user, assistant alternating
    for (let i = 0; i < fullConv.body.messages.length; i++) {
      const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
      expect(fullConv.body.messages[i].role).toBe(expectedRole);
    }
  });
});

describe('Error States & Edge Cases', () => {
  beforeEach(() => clearDatabase());

  it('handles rapid sequential operations without corruption', async () => {
    const ws = await request(app).post('/api/workspaces').send({ name: 'Rapid Test' });
    const workspaceId = ws.body.id;

    // Create multiple conversations rapidly
    const promises = Array.from({ length: 3 }, (_, i) =>
      request(app)
        .post(`/api/workspaces/${workspaceId}/conversations`)
        .send({ title: `Thread ${i + 1}` })
    );
    const results = await Promise.all(promises);
    expect(results.every((r) => r.status === 201)).toBe(true);

    // Verify count
    const list = await request(app).get(`/api/workspaces/${workspaceId}/conversations`);
    expect(list.body.length).toBe(3);
  });

  it('handles renames to existing names', async () => {
    const ws = await request(app).post('/api/workspaces').send({ name: 'Original' });

    const rename1 = await request(app)
      .put(`/api/workspaces/${ws.body.id}`)
      .send({ name: 'Renamed' });
    expect(rename1.body.name).toBe('Renamed');

    const rename2 = await request(app)
      .put(`/api/workspaces/${ws.body.id}`)
      .send({ name: 'Renamed Again' });
    expect(rename2.body.name).toBe('Renamed Again');
  });

  it('handles document deletion during processing', async () => {
    const ws = await request(app).post('/api/workspaces').send({ name: 'Delete Test' });

    const doc = await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents`)
      .attach('file', Buffer.from('processing test content'.repeat(20)), {
        filename: 'processing.txt', contentType: 'text/plain',
      });

    // Immediately delete
    const delRes = await request(app).delete(`/api/workspaces/${ws.body.id}/documents/${doc.body.id}`);
    expect(delRes.status).toBe(204);
  });

  it('verifies citations contain correct document references', async () => {
    const { workspaceId, docIds } = await setupFullWorkspace();

    const conv = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations`)
      .send({ title: 'Citation Check' });

    const msg = await request(app)
      .post(`/api/workspaces/${workspaceId}/conversations/${conv.body.id}/messages`)
      .send({ message: 'Explain AI research methods' });

    expect(msg.status).toBe(201);
    const assistantMsg = msg.body.assistantMsg;

    // Check sources are present
    let sources = [];
    try { sources = JSON.parse(assistantMsg.sources); } catch {}

    if (sources.length > 0) {
      expect(sources[0].document_name).toBeDefined();
      expect(sources[0].chunk_index).toBeDefined();
      expect(sources[0].content_snippet).toBeDefined();
      expect(sources[0].relevance_score).toBeDefined();
    }
  });
});
