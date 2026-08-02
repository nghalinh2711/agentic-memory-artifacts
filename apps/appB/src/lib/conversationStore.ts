import type { Conversation, ConversationStore, ConversationUpdate } from "./types";

const BASE_URL = "/api/conversations";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

class ApiConversationStore implements ConversationStore {
  async createConversation(collectionName: string): Promise<Conversation> {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionName }),
    });
    return handleResponse<Conversation>(res);
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const res = await fetch(`${BASE_URL}/${id}`);
    if (res.status === 404) return null;
    return handleResponse<Conversation>(res);
  }

  async getAllConversations(): Promise<Conversation[]> {
    const res = await fetch(BASE_URL);
    return handleResponse<Conversation[]>(res);
  }

  async updateConversation(id: string, updates: ConversationUpdate): Promise<Conversation> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return handleResponse<Conversation>(res);
  }

  async deleteConversation(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Delete failed");
    }
  }
}

export function createConversationStore(): ConversationStore {
  return new ApiConversationStore();
}
