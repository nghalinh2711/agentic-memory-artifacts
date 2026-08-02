import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { ChatMessage } from "@/lib/types";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "@/lib/serverConversationStore";
import { removeEntriesByConversation } from "@/lib/vectorStore";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const conv = getConversation(id);
  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  return NextResponse.json(conv);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const updates: { messages?: unknown; name?: unknown; uploadedFiles?: unknown } = body;
  const patch: { messages?: ChatMessage[]; name?: string; uploadedFiles?: string[] } = {};
  if (updates.messages !== undefined) {
    if (!Array.isArray(updates.messages)) {
      return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
    }
    patch.messages = updates.messages;
  }
  if (updates.name !== undefined) {
    if (typeof updates.name !== "string" || !updates.name.trim()) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    patch.name = updates.name.trim();
  }
  if (updates.uploadedFiles !== undefined) {
    if (!Array.isArray(updates.uploadedFiles)) {
      return NextResponse.json({ error: "uploadedFiles must be an array" }, { status: 400 });
    }
    patch.uploadedFiles = updates.uploadedFiles;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No update fields provided" }, { status: 400 });
  }
  try {
    const conv = updateConversation(id, patch);
    return NextResponse.json(conv);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const conv = getConversation(id);
    if (conv) {
      for (const filename of conv.uploadedFiles ?? []) {
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    deleteConversation(id);
    removeEntriesByConversation(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
