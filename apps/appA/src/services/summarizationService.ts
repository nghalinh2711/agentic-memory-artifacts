import OpenAI from 'openai';
import { config } from '../config';
import db from '../models/database';

interface SummaryResult {
  summary: string;
  sourceCount: number;
  chunkCount: number;
}

export class SummarizationService {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = config.openai.model;
  }

  /**
   * Summarize a single document using all its chunks
   */
  async summarizeDocument(documentId: string): Promise<SummaryResult> {
    const doc = db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(documentId) as any;

    if (!doc) throw new Error('Document not found');

    if (doc.status !== 'ready') {
      throw new Error(`Document is not ready (status: ${doc.status}). Process it first.`);
    }

    const chunks = db
      .prepare('SELECT content FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC')
      .all(documentId) as { content: string }[];

    if (chunks.length === 0) {
      throw new Error('No chunks found for this document. Process it first.');
    }

    const fullText = chunks.map((c) => c.content).join('\n\n');

    const prompt = `Please provide a concise, coherent summary of the following document titled "${doc.original_name}". 
Focus on key points, main arguments, and important findings. Keep the summary to 3-5 paragraphs.

Document content:
${fullText.substring(0, 15000)}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant that creates clear, accurate document summaries.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    return {
      summary: response.choices[0]?.message?.content || 'No summary generated.',
      sourceCount: 1,
      chunkCount: chunks.length,
    };
  }

  /**
   * Summarize an entire workspace by synthesizing all documents
   */
  async summarizeWorkspace(workspaceId: string): Promise<SummaryResult> {
    const docs = db
      .prepare(
        `SELECT id, original_name FROM documents 
         WHERE workspace_id = ? AND status = 'ready'
         ORDER BY created_at ASC`
      )
      .all(workspaceId) as { id: string; original_name: string }[];

    if (docs.length === 0) {
      return {
        summary: 'No documents have been processed in this workspace yet.',
        sourceCount: 0,
        chunkCount: 0,
      };
    }

    // Collect first chunks from each document for a high-level overview
    const docOverviews: string[] = [];
    let totalChunks = 0;

    for (const doc of docs) {
      const chunks = db
        .prepare('SELECT content FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT 3')
        .all(doc.id) as { content: string }[];

      totalChunks += (
        db.prepare('SELECT COUNT(*) as c FROM chunks WHERE document_id = ?').get(doc.id) as any
      ).c;

      if (chunks.length > 0) {
        const preview = chunks.map((c) => c.content).join(' ');
        docOverviews.push(`Document: "${doc.original_name}"\nContent preview: ${preview.substring(0, 500)}`);
      }
    }

    const prompt = `Please provide a high-level overview synthesizing all documents in this research workspace. 
Identify common themes, key findings, relationships between documents, and notable insights. 
Keep the summary to 4-6 paragraphs.

Documents in workspace (${docs.length} total):
${docOverviews.join('\n\n---\n\n')}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant that synthesizes information across multiple documents into coherent overviews.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return {
      summary: response.choices[0]?.message?.content || 'No summary generated.',
      sourceCount: docs.length,
      chunkCount: totalChunks,
    };
  }
}

export const summarizationService = new SummarizationService();
