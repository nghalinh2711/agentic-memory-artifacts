import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },
  database: {
    path: process.env.DATABASE_PATH || './data/rag-chatbot.db',
  },
  chroma: {
    url: process.env.CHROMA_URL || 'http://localhost:8000',
  },
  uploads: {
    maxSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10),
  },
};
