# AI RAG Chatbot for Research

A Retrieval-Augmented Generation (RAG) powered research assistant that lets you upload documents, chat with them, summarize, and compare content across documents.

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **OpenAI API key** (for embeddings and LLM responses)
- **ChromaDB** (optional, for production vector search; falls back to local SQLite search)

## Installation

```bash
npm install
```

## Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit `.env` and set your OpenAI API key:

```env
OPENAI_API_KEY=sk-your-actual-api-key
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `OPENAI_API_KEY` | (required) | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | LLM model for chat/summarization |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Model for text embeddings |
| `DATABASE_PATH` | `./data/rag-chatbot.db` | SQLite database file path |
| `CHROMA_URL` | `http://localhost:8000` | ChromaDB server URL |
| `MAX_UPLOAD_SIZE_MB` | `50` | Maximum file upload size |

## Running the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production build
npm run build
npm start
```

The server starts on **port 3001** by default.

Open http://localhost:3001 in your browser.

## Port Information

The application listens on **port 3001**. Port 3000 is reserved for other services.

## Features

### Workspace Management
- Create, rename, and delete research workspaces
- Each workspace isolates documents and conversations

### Document Upload
- Drag-and-drop or file picker for uploading documents
- Supported formats: **PDF**, **Word (.docx)**, **TXT**, **Markdown (.md)**
- Automatic text extraction and chunking
- Document processing pipeline: chunk → embed → index

### RAG Chat
- Ask questions about your documents
- AI answers grounded in your uploaded content
- Source citations with document name and section references
- Multi-turn conversation with context retention

### Summarization
- Summarize individual documents
- Generate workspace-wide synthesis across all documents

### Document Comparison
- Compare and contrast two or more documents
- Structured analysis: Overview, Similarities, Differences, Synthesis

## API Endpoints

### Workspaces
- `GET /api/workspaces` — List all workspaces
- `POST /api/workspaces` — Create workspace
- `GET /api/workspaces/:id` — Get workspace
- `PUT /api/workspaces/:id` — Rename workspace
- `DELETE /api/workspaces/:id` — Delete workspace (cascade)

### Documents
- `GET /api/workspaces/:id/documents` — List documents
- `POST /api/workspaces/:id/documents` — Upload document (multipart/form-data)
- `GET /api/workspaces/:id/documents/:docId` — Get document
- `PUT /api/workspaces/:id/documents/:docId` — Rename document
- `DELETE /api/workspaces/:id/documents/:docId` — Delete document
- `POST /api/workspaces/:id/documents/:docId/process` — Process document (chunk + embed)
- `POST /api/workspaces/:id/documents/:docId/summarize` — Summarize document

### Chat
- `GET /api/workspaces/:id/conversations` — List conversations
- `POST /api/workspaces/:id/conversations` — Create conversation
- `GET /api/workspaces/:id/conversations/:convId` — Get conversation with messages
- `PUT /api/workspaces/:id/conversations/:convId` — Rename conversation
- `DELETE /api/workspaces/:id/conversations/:convId` — Delete conversation
- `POST /api/workspaces/:id/conversations/:convId/messages` — Send message

### RAG & Analysis
- `POST /api/workspaces/:id/query` — RAG query
- `POST /api/workspaces/:id/summarize` — Summarize workspace
- `POST /api/workspaces/:id/compare` — Compare documents

### Health
- `GET /health` — Health check

## Testing

```bash
npm test
```

61 tests across 4 test suites:
- **24 API tests** — Workspace CRUD, document upload, document management
- **14 RAG pipeline tests** — Chunking, retrieval, citations, edge cases
- **13 Advanced feature tests** — Summarization, comparison, conversation integration
- **10 E2E tests** — Full user journeys, error states, cascade deletions

## Project Structure

```
src/
  config/          — Configuration
  models/          — Database schema and types
  services/        — Business logic
    chunkingService.ts
    comparisonService.ts
    conversationService.ts
    documentService.ts
    embeddingService.ts
    processingPipeline.ts
    ragQueryEngine.ts
    summarizationService.ts
    vectorStore.ts
    workspaceService.ts
  routes/          — API routes
    conversations.ts
    documents.ts
    index.ts
    query.ts
    workspaces.ts
  index.ts         — Server entry point
public/            — Static frontend
  index.html       — Workspace management UI
  workspace.html   — Document management UI
  chat.html        — Chat interface
  styles.css
  app.js
tests/             — Test suite
uploads/           — Uploaded files
data/              — SQLite database
```
