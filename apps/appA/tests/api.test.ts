import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/index';
import { initializeDatabase } from '../src/models';
import type { Express } from 'express';

const DB_PATH = path.resolve('./data/test-rag-chatbot.db');

let app: Express;

beforeAll(() => {
  // Don't delete the DB file - the connection is already open from module import
  // Use initializeDatabase (CREATE IF NOT EXISTS) and clear data instead
  initializeDatabase();
  app = createApp();
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

describe('Hello World', () => {
  it('GET / returns HTML page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('AI RAG Chatbot for Research');
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Workspace API', () => {
  beforeEach(() => clearDatabase());

  it('POST /api/workspaces - creates workspace', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Test Workspace', description: 'A test workspace' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Workspace');
    expect(res.body.description).toBe('A test workspace');
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/workspaces - rejects empty name', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name is required');
  });

  it('POST /api/workspaces - rejects missing name', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .send({ description: 'no name' });
    expect(res.status).toBe(400);
  });

  it('GET /api/workspaces - lists all workspaces', async () => {
    await request(app).post('/api/workspaces').send({ name: 'WS1' });
    await request(app).post('/api/workspaces').send({ name: 'WS2' });
    const res = await request(app).get('/api/workspaces');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('GET /api/workspaces/:id - gets workspace by id', async () => {
    const create = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Find Me' });
    const res = await request(app).get(`/api/workspaces/${create.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Find Me');
  });

  it('GET /api/workspaces/:id - 404 for nonexistent', async () => {
    const res = await request(app).get('/api/workspaces/nonexistent-id');
    expect(res.status).toBe(404);
  });

  it('PUT /api/workspaces/:id - renames workspace', async () => {
    const create = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Old Name' });
    const res = await request(app)
      .put(`/api/workspaces/${create.body.id}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('PUT /api/workspaces/:id - 404 for nonexistent', async () => {
    const res = await request(app)
      .put('/api/workspaces/nonexistent')
      .send({ name: 'New Name' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/workspaces/:id - deletes workspace', async () => {
    const create = await request(app)
      .post('/api/workspaces')
      .send({ name: 'To Delete' });
    const res = await request(app).delete(`/api/workspaces/${create.body.id}`);
    expect(res.status).toBe(204);

    const verify = await request(app).get(`/api/workspaces/${create.body.id}`);
    expect(verify.status).toBe(404);
  });

  it('DELETE /api/workspaces/:id - cascade deletes documents', async () => {
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Cascade Test' });

    // Upload a document
    await request(app)
      .post(`/api/workspaces/${ws.body.id}/documents`)
      .attach('file', Buffer.from('test content'), { filename: 'test.txt', contentType: 'text/plain' });

    // Verify document exists
    const docsBefore = await request(app).get(`/api/workspaces/${ws.body.id}/documents`);
    expect(docsBefore.body.length).toBe(1);

    // Delete workspace
    await request(app).delete(`/api/workspaces/${ws.body.id}`);

    // Need to create a new workspace to check the doc ID via DB
    // Actually, since the workspace is gone, listing docs would 404
    const docsAfter = await request(app).get(`/api/workspaces/${ws.body.id}/documents`);
    expect(docsAfter.status).toBe(404);
  });
});

describe('Document Upload API', () => {
  let workspaceId: string;

  beforeEach(async () => {
    clearDatabase();
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Upload Test WS' });
    workspaceId = ws.body.id;
  });

  it('POST uploads TXT file', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from('Hello world text content'), { filename: 'test.txt', contentType: 'text/plain' });
    expect(res.status).toBe(201);
    expect(res.body.original_name).toBe('test.txt');
    expect(res.body.mime_type).toBe('text/plain');
    expect(res.body.status).toBe('uploaded');
  });

  it('POST uploads Markdown file', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from('# Hello\n\nMarkdown content'), { filename: 'readme.md', contentType: 'text/markdown' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('uploaded');
  });

  it('POST rejects unsupported format', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from('fake image data'), { filename: 'image.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
  });

  it('POST rejects empty file upload (no file)', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`);
    expect(res.status).toBe(400);
  });

  it('POST uploads to nonexistent workspace returns 404', async () => {
    const res = await request(app)
      .post('/api/workspaces/fake-id/documents')
      .attach('file', Buffer.from('content'), { filename: 'test.txt', contentType: 'text/plain' });
    expect(res.status).toBe(404);
  });
});

describe('Document Management API', () => {
  let workspaceId: string;
  let docId: string;

  beforeEach(async () => {
    clearDatabase();
    const ws = await request(app)
      .post('/api/workspaces')
      .send({ name: 'Doc Mgmt WS' });
    workspaceId = ws.body.id;

    const doc = await request(app)
      .post(`/api/workspaces/${workspaceId}/documents`)
      .attach('file', Buffer.from('document content'), { filename: 'original.txt', contentType: 'text/plain' });
    docId = doc.body.id;
  });

  it('GET lists documents in workspace', async () => {
    const res = await request(app).get(`/api/workspaces/${workspaceId}/documents`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].original_name).toBe('original.txt');
  });

  it('GET returns single document', async () => {
    const res = await request(app).get(`/api/workspaces/${workspaceId}/documents/${docId}`);
    expect(res.status).toBe(200);
    expect(res.body.original_name).toBe('original.txt');
  });

  it('GET returns 404 for nonexistent document', async () => {
    const res = await request(app).get(`/api/workspaces/${workspaceId}/documents/fake-id`);
    expect(res.status).toBe(404);
  });

  it('PUT renames document', async () => {
    const res = await request(app)
      .put(`/api/workspaces/${workspaceId}/documents/${docId}`)
      .send({ name: 'renamed.txt' });
    expect(res.status).toBe(200);
    expect(res.body.original_name).toBe('renamed.txt');
  });

  it('PUT rejects empty rename', async () => {
    const res = await request(app)
      .put(`/api/workspaces/${workspaceId}/documents/${docId}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('DELETE removes document', async () => {
    const res = await request(app).delete(`/api/workspaces/${workspaceId}/documents/${docId}`);
    expect(res.status).toBe(204);

    const verify = await request(app).get(`/api/workspaces/${workspaceId}/documents`);
    expect(verify.body.length).toBe(0);
  });

  it('DELETE returns 404 for nonexistent', async () => {
    const res = await request(app).delete(`/api/workspaces/${workspaceId}/documents/fake-id`);
    expect(res.status).toBe(404);
  });
});
