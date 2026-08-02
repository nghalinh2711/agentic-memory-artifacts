import fs from "node:fs";
import path from "node:path";
import type { Conversation, ChatMessage } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll(): Conversation[] {
  ensureDataDir();
  if (!fs.existsSync(CONVERSATIONS_FILE)) {
    fs.writeFileSync(CONVERSATIONS_FILE, "[]", "utf-8");
    return [];
  }
  const raw = fs.readFileSync(CONVERSATIONS_FILE, "utf-8");
  return JSON.parse(raw) as Conversation[];
}

function writeAll(conversations: Conversation[]): void {
  ensureDataDir();
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2), "utf-8");
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function createConversation(collectionName: string): Conversation {
  const conversations = readAll();
  const conv: Conversation = {
    id: generateId(),
    name: collectionName,
    collectionName,
    messages: [],
    uploadedFiles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  conversations.push(conv);
  writeAll(conversations);
  return conv;
}

export function getConversation(id: string): Conversation | null {
  const conversations = readAll();
  return conversations.find((c) => c.id === id) ?? null;
}

export function getAllConversations(): Conversation[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function updateConversation(
  id: string,
  updates: { messages?: ChatMessage[]; name?: string; uploadedFiles?: string[] },
): Conversation {
  const conversations = readAll();
  const index = conversations.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Conversation "${id}" not found`);
  if (updates.messages !== undefined) conversations[index].messages = updates.messages;
  if (updates.name !== undefined) conversations[index].name = updates.name;
  if (updates.uploadedFiles !== undefined) conversations[index].uploadedFiles = updates.uploadedFiles;
  conversations[index].updatedAt = new Date().toISOString();
  writeAll(conversations);
  return conversations[index];
}

export function deleteConversation(id: string): void {
  const conversations = readAll();
  const index = conversations.findIndex((c) => c.id === id);
  if (index === -1) throw new Error(`Conversation "${id}" not found`);
  conversations.splice(index, 1);
  writeAll(conversations);
}
