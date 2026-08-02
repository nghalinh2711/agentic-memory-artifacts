export interface Workspace {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  status: 'uploaded' | 'processing' | 'ready' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: string; // JSON string of source references
  created_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata: string; // JSON string of metadata
  created_at: string;
}

export interface Embedding {
  id: string;
  chunk_id: string;
  created_at: string;
}

export interface SourceReference {
  document_name: string;
  chunk_index: number;
  content_snippet: string;
  relevance_score: number;
}
