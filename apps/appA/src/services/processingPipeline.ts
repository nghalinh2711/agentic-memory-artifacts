import { v4 as uuidv4 } from 'uuid';
import db from '../models/database';
import { documentService } from './documentService';
import { chunkingService } from './chunkingService';
import { embeddingService } from './embeddingService';
import { vectorStore } from './vectorStore';

export class DocumentProcessingPipeline {
  /**
   * Process an uploaded document:
   * 1. Extract text from the file
   * 2. Split into chunks
   * 3. Generate embeddings
   * 4. Store chunks and embeddings
   */
  async processDocument(documentId: string): Promise<{ success: boolean; chunkCount: number; error?: string }> {
    const doc = documentService.getById(documentId);
    if (!doc) {
      return { success: false, chunkCount: 0, error: 'Document not found' };
    }

    try {
      // Update status to processing
      db.prepare("UPDATE documents SET status = 'processing', updated_at = datetime('now') WHERE id = ?")
        .run(documentId);

      // Extract text
      const text = await documentService.extractText(doc.file_path, doc.mime_type);

      if (!text || text.trim().length === 0) {
        db.prepare("UPDATE documents SET status = 'error', updated_at = datetime('now') WHERE id = ?")
          .run(documentId);
        return { success: false, chunkCount: 0, error: 'No text extracted from document' };
      }

      // Split into chunks
      const chunks = chunkingService.splitText(text, documentId, {
        document_name: doc.original_name,
        workspace_id: doc.workspace_id,
      });

      if (chunks.length === 0) {
        db.prepare("UPDATE documents SET status = 'error', updated_at = datetime('now') WHERE id = ?")
          .run(documentId);
        return { success: false, chunkCount: 0, error: 'No chunks generated' };
      }

      // Store chunks in database
      chunkingService.storeChunks(chunks);

      // Generate embeddings
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedTexts(chunkTexts);

      // Store embeddings in vector store
      if (vectorStore.isAvailable()) {
        const embeddingIds: string[] = [];
        const metadatas: Record<string, string>[] = [];

        for (const chunk of chunks) {
          const embId = uuidv4();
          embeddingIds.push(embId);

          // Store embedding record in SQLite
          db.prepare('INSERT INTO embeddings (id, chunk_id) VALUES (?, ?)').run(embId, chunk.id);

          metadatas.push({
            document_id: documentId,
            document_name: doc.original_name,
            workspace_id: doc.workspace_id,
            chunk_id: chunk.id,
            chunk_index: String(chunk.chunkIndex),
          });
        }

        await vectorStore.addEmbeddings(embeddingIds, embeddings, chunkTexts, metadatas);
      } else {
        // Still record embedding references even if vector store is unavailable
        for (const chunk of chunks) {
          const embId = uuidv4();
          db.prepare('INSERT INTO embeddings (id, chunk_id) VALUES (?, ?)').run(embId, chunk.id);
        }
      }

      // Update document status to ready
      db.prepare("UPDATE documents SET status = 'ready', updated_at = datetime('now') WHERE id = ?")
        .run(documentId);

      return { success: true, chunkCount: chunks.length };
    } catch (error: any) {
      db.prepare("UPDATE documents SET status = 'error', updated_at = datetime('now') WHERE id = ?")
        .run(documentId);
      return { success: false, chunkCount: 0, error: error.message };
    }
  }

  /**
   * Reprocess a document (useful if chunking/embedding failed)
   */
  async reprocessDocument(documentId: string): Promise<{ success: boolean; chunkCount: number; error?: string }> {
    // Delete existing chunks and embeddings
    const chunks = db.prepare('SELECT id FROM chunks WHERE document_id = ?').all(documentId) as { id: string }[];

    if (vectorStore.isAvailable() && chunks.length > 0) {
      const chunkIds = chunks.map((c) => c.id);
      const embRecords = db
        .prepare(
          `SELECT id FROM embeddings WHERE chunk_id IN (${chunkIds.map(() => '?').join(',')})`
        )
        .all(...chunkIds) as { id: string }[];

      if (embRecords.length > 0) {
        await vectorStore.deleteEmbeddings(embRecords.map((e) => e.id));
      }
    }

    db.prepare('DELETE FROM embeddings WHERE chunk_id IN (SELECT id FROM chunks WHERE document_id = ?)').run(documentId);
    db.prepare('DELETE FROM chunks WHERE document_id = ?').run(documentId);

    return this.processDocument(documentId);
  }

  /**
   * Get chunk count for a document
   */
  getChunkCount(documentId: string): number {
    const result = db
      .prepare('SELECT COUNT(*) as count FROM chunks WHERE document_id = ?')
      .get(documentId) as { count: number };
    return result?.count ?? 0;
  }
}

export const processingPipeline = new DocumentProcessingPipeline();
