import { v4 as uuidv4 } from 'uuid';
import db from '../models/database';
import type { Conversation, Message, SourceReference } from '../models/types';
import { ragQueryEngine } from './ragQueryEngine';

export class ConversationService {
  create(workspaceId: string, title: string = 'New Conversation'): Conversation {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO conversations (id, workspace_id, title) VALUES (?, ?, ?)'
    ).run(id, workspaceId, title);

    return this.getById(id)!;
  }

  getById(id: string): Conversation | undefined {
    return db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(id) as Conversation | undefined;
  }

  getByWorkspace(workspaceId: string): Conversation[] {
    return db
      .prepare('SELECT * FROM conversations WHERE workspace_id = ? ORDER BY updated_at DESC')
      .all(workspaceId) as Conversation[];
  }

  rename(id: string, title: string): Conversation | null {
    const conv = this.getById(id);
    if (!conv) return null;

    db.prepare("UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?")
      .run(title, id);

    return this.getById(id)!;
  }

  delete(id: string): boolean {
    const conv = this.getById(id);
    if (!conv) return false;

    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    return true;
  }

  getMessages(conversationId: string): Message[] {
    return db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conversationId) as Message[];
  }

  /**
   * Send a message in a conversation with RAG context
   */
  async sendMessage(
    conversationId: string,
    workspaceId: string,
    userMessage: string
  ): Promise<{
    userMsg: Message;
    assistantMsg: Message;
  }> {
    const conv = this.getById(conversationId);
    if (!conv) throw new Error('Conversation not found');

    // Get conversation history for context
    const history = this.getMessages(conversationId);

    // Store user message
    const userMsgId = uuidv4();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(userMsgId, conversationId, 'user', userMessage);

    // Invoke RAG query engine
    const { answer, sources } = await ragQueryEngine.query(
      userMessage,
      workspaceId
    );

    // Store assistant message with sources
    const assistantMsgId = uuidv4();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, sources) VALUES (?, ?, ?, ?, ?)'
    ).run(assistantMsgId, conversationId, 'assistant', answer, JSON.stringify(sources));

    // Update conversation timestamp
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
      .run(conversationId);

    // Auto-title: if first message, use it as title
    if (history.length === 0 && conv.title === 'New Conversation') {
      const shortTitle = userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : '');
      this.rename(conversationId, shortTitle);
    }

    return {
      userMsg: this.getMessageById(userMsgId)!,
      assistantMsg: this.getMessageById(assistantMsgId)!,
    };
  }

  /**
   * Store a user message and return it (used by streaming endpoint)
   */
  storeUserMessage(conversationId: string, content: string): Message {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)'
    ).run(id, conversationId, 'user', content);
    return this.getMessageById(id)!;
  }

  /**
   * Store an assistant message and return it (used by streaming endpoint)
   */
  storeAssistantMessage(conversationId: string, content: string, sources: string = '[]'): Message {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, sources) VALUES (?, ?, ?, ?, ?)'
    ).run(id, conversationId, 'assistant', content, sources);

    // Update conversation timestamp
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
      .run(conversationId);

    return this.getMessageById(id)!;
  }

  /**
   * Stream a RAG response (used by SSE endpoint)
   */
  async *streamResponse(
    conversationId: string,
    workspaceId: string,
    userMessage: string
  ): AsyncGenerator<{ token: string } | { sources: any[]; done: true }> {
    for await (const event of ragQueryEngine.queryStream(userMessage, workspaceId)) {
      yield event;
    }
  }

  private getMessageById(id: string): Message | undefined {
    return db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .get(id) as Message | undefined;
  }

  private buildHistoryContext(history: Message[]): string {
    if (history.length === 0) return '';

    return history
      .slice(-6) // Last 3 exchanges (6 messages)
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  }
}

export const conversationService = new ConversationService();
