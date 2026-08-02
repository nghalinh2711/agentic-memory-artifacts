# AI Chatbot RAG

AI-powered document chat with Retrieval-Augmented Generation (RAG). Upload documents and ask questions — the chatbot retrieves relevant context and generates answers with source citations.

## Prerequisites

- **Node.js** >= 18
- **pnpm** (install via `npm install -g pnpm` or `corepack enable`)
- **OpenAI API key** (for LLM and embeddings)

## Installation

```bash
pnpm install
```

## Configuration

Copy the example environment file and set your OpenAI API key:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Running the Application

```bash
pnpm dev
```

Open [http://localhost:3002](http://localhost:3002) in your browser.

## Port Information

The application listens on port **3002** (port 3000 is reserved by the local agentic memory system).

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **MUI 7** (Material UI) — theme tokens only, no plain CSS
- **pnpm** package manager
- **Vercel** deployment target
