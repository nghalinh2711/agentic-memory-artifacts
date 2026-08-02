import OpenAI from 'openai';
import { config } from '../config';
import db from '../models/database';

interface ComparisonResult {
  comparison: string;
  documentsCompared: number;
  documentNames: string[];
}

export class ComparisonService {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = config.openai.model;
  }

  /**
   * Compare two or more documents within a workspace
   */
  async compareDocuments(
    workspaceId: string,
    documentIds: string[]
  ): Promise<ComparisonResult> {
    if (documentIds.length < 2) {
      return {
        comparison: 'Please select at least two documents to compare. A comparison requires multiple documents to analyze similarities and differences.',
        documentsCompared: documentIds.length,
        documentNames: [],
      };
    }

    // Validate documents exist and belong to workspace
    const placeholders = documentIds.map(() => '?').join(',');
    const docs = db
      .prepare(
        `SELECT id, original_name, status FROM documents 
         WHERE id IN (${placeholders}) AND workspace_id = ?`
      )
      .all(...documentIds, workspaceId) as { id: string; original_name: string; status: string }[];

    if (docs.length < 2) {
      return {
        comparison: 'Not enough valid documents found for comparison. Please ensure at least two processed documents exist in this workspace.',
        documentsCompared: docs.length,
        documentNames: docs.map((d) => d.original_name),
      };
    }

    // Collect content previews from each document
    const docContents: { name: string; content: string }[] = [];

    for (const doc of docs) {
      if (doc.status !== 'ready') {
        continue;
      }

      const chunks = db
        .prepare('SELECT content FROM chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT 5')
        .all(doc.id) as { content: string }[];

      if (chunks.length > 0) {
        docContents.push({
          name: doc.original_name,
          content: chunks.map((c) => c.content).join(' ').substring(0, 2000),
        });
      }
    }

    if (docContents.length < 2) {
      return {
        comparison: 'At least two documents must be fully processed (status: ready) for comparison. Process the documents first.',
        documentsCompared: docContents.length,
        documentNames: docContents.map((d) => d.name),
      };
    }

    // Build prompt for comparison
    const docsText = docContents
      .map((d, i) => `Document ${i + 1}: "${d.name}"\nContent: ${d.content}`)
      .join('\n\n---\n\n');

    const prompt = `Please provide a structured comparison and contrast analysis of the following ${docContents.length} documents. 
Organize your response with these sections:

1. **Overview**: Brief summary of each document
2. **Key Similarities**: Common themes, shared findings, or overlapping arguments
3. **Key Differences**: Divergent perspectives, unique findings, or contrasting approaches
4. **Synthesis**: How these documents relate to each other and potential insights from reading them together

${docsText}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a research analyst that creates clear, structured document comparisons.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    return {
      comparison: response.choices[0]?.message?.content || 'No comparison generated.',
      documentsCompared: docContents.length,
      documentNames: docContents.map((d) => d.name),
    };
  }
}

export const comparisonService = new ComparisonService();
