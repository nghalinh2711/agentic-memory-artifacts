import { NextRequest, NextResponse } from "next/server";
import { queryRAG, streamRAG } from "@/lib/ragService";
import { generateEmbedding } from "@/lib/embeddingService";
import { search } from "@/lib/vectorStore";
import OpenAI from "openai";

const deps = {
  generateEmbedding,
  search,
  createOpenAIClient: () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const query = body.query as string | undefined;
  const conversationId = body.conversationId as string | undefined;
  if (!query || !query.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }
  const useStream = body.stream !== false;
  if (useStream) return handleStream(query, conversationId, body.topK);
  const result = await queryRAG({ query, conversationId, topK: body.topK }, deps);
  return NextResponse.json(result);
}

async function handleStream(query: string, conversationId: string, topK?: number) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = streamRAG({ query, conversationId, topK }, deps);
        for await (const event of generator) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        const err = e instanceof Error ? e.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

