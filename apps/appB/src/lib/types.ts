export interface ChunkMetadata {
  sourceFilename: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface Chunk {
  text: string;
  metadata: ChunkMetadata;
}

export interface ExtractionResult {
  text: string;
  pageCount?: number;
}

export type EmbeddingVector = number[];

export interface VectorStoreEntry {
  conversationId: string;
  chunk: Chunk;
  embedding: EmbeddingVector;
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
}

export interface DocumentEntry {
  filename: string;
  uploadedAt: string;
}

export interface Collection {
  name: string;
  documents: DocumentEntry[];
  createdAt: string;
}

export interface CollectionManager {
  createCollection(name: string): Collection;
  deleteCollection(name: string): void;
  getCollection(name: string): Collection | null;
  getAllCollections(): Collection[];
  addDocument(collectionName: string, document: DocumentEntry): void;
  removeDocument(collectionName: string, filename: string): void;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SearchResult[];
}

export interface Conversation {
  id: string;
  name: string;
  collectionName: string;
  messages: ChatMessage[];
  uploadedFiles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationUpdate {
  messages?: ChatMessage[];
  name?: string;
  uploadedFiles?: string[];
}

export interface ConversationStore {
  createConversation(collectionName: string): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  getAllConversations(): Promise<Conversation[]>;
  updateConversation(id: string, updates: ConversationUpdate): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
}


