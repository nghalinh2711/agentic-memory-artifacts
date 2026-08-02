import { NextRequest, NextResponse } from "next/server";
import {
  getAllConversations,
  createConversation,
} from "@/lib/serverConversationStore";

export async function GET() {
  const conversations = getAllConversations();
  return NextResponse.json(conversations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const collectionName = (body.collectionName as string) || "Default";
  const conv = createConversation(collectionName);
  return NextResponse.json(conv, { status: 201 });
}
