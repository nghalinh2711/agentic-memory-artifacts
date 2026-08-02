import { v4 as uuidv4 } from 'uuid';
import db from '../models/database';

export interface TextChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, string>;
}

export class ChunkingService {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  /**
   * Split text into semantic chunks by paragraph boundaries,
   * then combine paragraphs to meet target chunk size with overlap.
   */
  splitText(text: string, documentId: string, metadata: Record<string, string> = {}): TextChunk[] {
    // Split by paragraphs (double newlines)
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds chunk size, save current chunk
      if (currentChunk.length + paragraph.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: uuidv4(),
          documentId,
          chunkIndex,
          content: currentChunk.trim(),
          metadata: { ...metadata },
        });
        chunkIndex++;

        // Start new chunk with overlap: keep last portion of previous chunk
        const words = currentChunk.split(/\s+/);
        const overlapWords = Math.floor(this.chunkOverlap / 5); // ~5 chars per word
        const overlapStart = Math.max(0, words.length - overlapWords);
        currentChunk = words.slice(overlapStart).join(' ') + '\n\n';
      }

      currentChunk += paragraph + '\n\n';
    }

    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: uuidv4(),
        documentId,
        chunkIndex,
        content: currentChunk.trim(),
        metadata: { ...metadata },
      });
    }

    return chunks;
  }

  /**
   * Store chunks in the database
   */
  storeChunks(chunks: TextChunk[]): void {
    const stmt = db.prepare(
      'INSERT INTO chunks (id, document_id, chunk_index, content, metadata) VALUES (?, ?, ?, ?, ?)'
    );

    const insertMany = db.transaction((chunks: TextChunk[]) => {
      for (const chunk of chunks) {
        stmt.run(chunk.id, chunk.documentId, chunk.chunkIndex, chunk.content, JSON.stringify(chunk.metadata));
      }
    });

    insertMany(chunks);
  }
}

export const chunkingService = new ChunkingService();
