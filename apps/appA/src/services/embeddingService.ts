import OpenAI from 'openai';
import { config } from '../config';

export class EmbeddingService {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.openai.apiKey });
    this.model = config.openai.embeddingModel;
  }

  /**
   * Generate embeddings for an array of text strings
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });

    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  /**
   * Generate a single embedding
   */
  async embedText(text: string): Promise<number[]> {
    const embeddings = await this.embedTexts([text]);
    return embeddings[0];
  }
}

export const embeddingService = new EmbeddingService();
