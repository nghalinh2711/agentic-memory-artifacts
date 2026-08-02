import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';
import db from '../models/database';

// pdf-parse v2.4.5 exports PDFParse as a class; constructor takes { data }, then call load() + getText()
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (opts: { data: Uint8Array }) => { load(): Promise<void>; getText(): Promise<{ text: string }> };
};
import type { Document } from '../models/types';
import { vectorStore } from './vectorStore';

const UPLOADS_DIR = path.resolve('uploads');

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/x-markdown': 'md',
};

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  await parser.load();
  const result = await parser.getText();
  return result.text;
}

export class DocumentService {
  private async ensureUploadDir(): Promise<void> {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }

  isSupported(mimeType: string): boolean {
    return mimeType in SUPPORTED_MIME_TYPES;
  }

  async extractText(filePath: string, mimeType: string): Promise<string> {
    const buffer = await fs.readFile(filePath);

    switch (mimeType) {
      case 'application/pdf': {
        return extractPdfText(buffer);
      }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
      case 'text/plain':
      case 'text/markdown':
      case 'text/x-markdown':
        return buffer.toString('utf-8');
      default: {
        // Fallback: detect by file extension (browsers may not send correct MIME for .md/.txt)
        const ext = path.extname(filePath).toLowerCase();
        if (['.txt', '.md'].includes(ext)) {
          return buffer.toString('utf-8');
        }
        throw new Error(`Unsupported file type: ${mimeType} (${ext})`);
      }
    }
  }

  async upload(
    workspaceId: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer
  ): Promise<Document> {
    await this.ensureUploadDir();

    const id = uuidv4();
    const ext = SUPPORTED_MIME_TYPES[mimeType] || path.extname(originalName).replace(/^\./, '') || 'txt';
    const filename = `${id}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Write file to disk
    await fs.writeFile(filePath, buffer);

    const fileSize = buffer.length;

    const stmt = db.prepare(
      `INSERT INTO documents (id, workspace_id, filename, original_name, mime_type, file_size, file_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(id, workspaceId, filename, originalName, mimeType, fileSize, filePath, 'uploaded');

    return this.getById(id)!;
  }

  getById(id: string): Document | undefined {
    return db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(id) as Document | undefined;
  }

  getByWorkspace(workspaceId: string): Document[] {
    return db
      .prepare('SELECT * FROM documents WHERE workspace_id = ? ORDER BY created_at DESC')
      .all(workspaceId) as Document[];
  }

  rename(id: string, newName: string): Document | null {
    const doc = this.getById(id);
    if (!doc) return null;

    db.prepare(
      "UPDATE documents SET original_name = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newName, id);

    return this.getById(id)!;
  }

  delete(id: string): boolean {
    const doc = this.getById(id);
    if (!doc) return false;

    // Clean up vector store embeddings for this document's chunks
    if (vectorStore.isAvailable()) {
      const embRecords = db
        .prepare(
          `SELECT e.id FROM embeddings e
           JOIN chunks c ON e.chunk_id = c.id
           WHERE c.document_id = ?`
        )
        .all(id) as { id: string }[];

      if (embRecords.length > 0) {
        vectorStore.deleteEmbeddings(embRecords.map((e) => e.id)).catch(() => {});
      }
    }

    // Delete file from disk
    fs.unlink(doc.file_path).catch(() => {});

    // Delete from DB (cascade handles chunks, embeddings)
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return true;
  }
}

export const documentService = new DocumentService();
