import { v4 as uuidv4 } from 'uuid';
import db from '../models/database';
import type { Workspace } from '../models/types';
import { vectorStore } from './vectorStore';
import fs from 'fs';

export class WorkspaceService {
  create(name: string, description: string = ''): Workspace {
    const id = uuidv4();
    const stmt = db.prepare(
      'INSERT INTO workspaces (id, name, description) VALUES (?, ?, ?)'
    );
    stmt.run(id, name, description);

    return this.getById(id)!;
  }

  getAll(): Workspace[] {
    return db
      .prepare('SELECT * FROM workspaces ORDER BY created_at DESC')
      .all() as Workspace[];
  }

  getById(id: string): Workspace | undefined {
    return db
      .prepare('SELECT * FROM workspaces WHERE id = ?')
      .get(id) as Workspace | undefined;
  }

  update(id: string, name: string, description?: string): Workspace | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const stmt = db.prepare(
      'UPDATE workspaces SET name = ?, description = COALESCE(?, description), updated_at = datetime(\'now\') WHERE id = ?'
    );
    stmt.run(name, description ?? null, id);

    return this.getById(id)!;
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;

    // Clean up vector store embeddings for all documents in this workspace
    if (vectorStore.isAvailable()) {
      const chunkRecords = db
        .prepare(
          `SELECT e.id FROM embeddings e
           JOIN chunks c ON e.chunk_id = c.id
           JOIN documents d ON c.document_id = d.id
           WHERE d.workspace_id = ?`
        )
        .all(id) as { id: string }[];

      if (chunkRecords.length > 0) {
        vectorStore.deleteEmbeddings(chunkRecords.map((e) => e.id)).catch(() => {});
      }
    }

    // Delete physical files from disk for all documents in this workspace
    const docs = db
      .prepare('SELECT file_path FROM documents WHERE workspace_id = ?')
      .all(id) as { file_path: string }[];

    for (const doc of docs) {
      fs.unlink(doc.file_path, () => {});
    }

    // Cascade delete handled by SQLite foreign keys (documents, chunks, embeddings, conversations, messages)
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return true;
  }
}

export const workspaceService = new WorkspaceService();
