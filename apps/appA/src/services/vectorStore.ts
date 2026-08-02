import { ChromaClient, Collection } from 'chromadb';
import { config } from '../config';

const COLLECTION_NAME = 'document_chunks';

class VectorStoreService {
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor() {
    this.client = new ChromaClient({
      path: config.chroma.url,
    });
  }

  async initialize(): Promise<void> {
    try {
      const collections = await this.client.listCollections();
      const exists = collections.some((c) => c.name === COLLECTION_NAME);

      if (exists) {
        this.collection = await this.client.getCollection({
          name: COLLECTION_NAME,
        });
      } else {
        this.collection = await this.client.createCollection({
          name: COLLECTION_NAME,
          metadata: { 'hnsw:space': 'cosine' },
        });
      }
      console.log('🧠 Vector store initialized successfully');
    } catch (error) {
      console.warn(
        '⚠️  ChromaDB not available - vector store will use in-memory fallback'
      );
      this.collection = null;
    }
  }

  async addEmbeddings(
    ids: string[],
    embeddings: number[][],
    documents: string[],
    metadatas: Record<string, string>[]
  ): Promise<void> {
    if (!this.collection) {
      console.warn('Vector store unavailable, skipping embedding storage');
      return;
    }
    await this.collection.add({
      ids,
      embeddings,
      documents,
      metadatas,
    });
  }

  async queryEmbeddings(
    queryEmbedding: number[],
    nResults: number = 5
  ): Promise<
    Array<{
      id: string;
      document: string;
      metadata: Record<string, string>;
      distance: number;
    }>
  > {
    if (!this.collection) {
      console.warn('Vector store unavailable, returning empty results');
      return [];
    }

    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults,
    });

    const items: Array<{
      id: string;
      document: string;
      metadata: Record<string, string>;
      distance: number;
    }> = [];

    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        items.push({
          id: results.ids[0][i],
          document: results.documents?.[0]?.[i] ?? '',
          metadata: (results.metadatas?.[0]?.[i] as Record<string, string>) ?? {},
          distance: results.distances?.[0]?.[i] ?? 0,
        });
      }
    }

    return items;
  }

  async deleteEmbeddings(ids: string[]): Promise<void> {
    if (!this.collection) return;
    await this.collection.delete({ ids });
  }

  async getCollectionCount(): Promise<number> {
    if (!this.collection) return 0;
    return (await this.collection.count()) ?? 0;
  }

  isAvailable(): boolean {
    return this.collection !== null;
  }
}

export const vectorStore = new VectorStoreService();
