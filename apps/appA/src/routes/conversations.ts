import { Router, Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { workspaceService } from '../services/workspaceService';

const router = Router({ mergeParams: true });

// Middleware to validate workspace
function validateWorkspace(req: Request, res: Response, next: Function) {
  const { workspaceId } = req.params as { workspaceId: string };
  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  next();
}

router.use(validateWorkspace);

// POST /api/workspaces/:workspaceId/conversations - Create conversation
router.post('/', (req: Request, res: Response) => {
  const { workspaceId } = req.params as { workspaceId: string };
  const { title } = req.body;

  const conversation = conversationService.create(workspaceId, title || undefined);
  res.status(201).json(conversation);
});

// GET /api/workspaces/:workspaceId/conversations - List conversations
router.get('/', (req: Request, res: Response) => {
  const { workspaceId } = req.params as { workspaceId: string };
  const conversations = conversationService.getByWorkspace(workspaceId);
  res.json(conversations);
});

// GET /api/workspaces/:workspaceId/conversations/:convId - Get conversation with messages
router.get('/:convId', (req: Request, res: Response) => {
  const { convId } = req.params as { convId: string };
  const conversation = conversationService.getById(convId);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const messages = conversationService.getMessages(convId);
  res.json({ ...conversation, messages });
});

// PUT /api/workspaces/:workspaceId/conversations/:convId - Rename conversation
router.put('/:convId', (req: Request, res: Response) => {
  const { convId } = req.params as { convId: string };
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const conversation = conversationService.rename(convId, title.trim());
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json(conversation);
});

// DELETE /api/workspaces/:workspaceId/conversations/:convId - Delete conversation
router.delete('/:convId', (req: Request, res: Response) => {
  const { convId } = req.params as { convId: string };
  const deleted = conversationService.delete(convId);
  if (!deleted) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.status(204).send();
});

// POST /api/workspaces/:workspaceId/conversations/:convId/messages - Send message
router.post('/:convId/messages', async (req: Request, res: Response) => {
  const { workspaceId, convId } = req.params as { workspaceId: string; convId: string };
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const result = await conversationService.sendMessage(convId, workspaceId, message.trim());
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workspaces/:workspaceId/conversations/:convId/stream - Streaming RAG message
router.post('/:convId/stream', async (req: Request, res: Response) => {
  const { workspaceId, convId } = req.params as { workspaceId: string; convId: string };
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const conv = conversationService.getById(convId);
    if (!conv) {
      sendSSE('error', { error: 'Conversation not found' });
      res.end();
      return;
    }

    // Store user message
    const userMsg = conversationService.storeUserMessage(convId, message.trim());

    sendSSE('user_message', { id: userMsg.id, role: 'user', content: userMsg.content });

    // Stream the RAG response
    let fullAnswer = '';
    for await (const event of conversationService.streamResponse(convId, workspaceId, message.trim())) {
      if ('done' in event && event.done) {
        sendSSE('sources', { sources: event.sources });
      } else if ('token' in event) {
        fullAnswer += event.token;
        sendSSE('token', { token: event.token });
      }
    }

    // Store assistant message
    const assistantMsg = conversationService.storeAssistantMessage(convId, fullAnswer);

    // Auto-title if first message
    const history = conversationService.getMessages(convId);
    if (history.length <= 2 && conv.title === 'New Conversation') {
      const shortTitle = message.trim().substring(0, 80) + (message.trim().length > 80 ? '...' : '');
      conversationService.rename(convId, shortTitle);
    }

    sendSSE('done', { messageId: assistantMsg.id, fullContent: fullAnswer });
    res.end();
  } catch (error: any) {
    sendSSE('error', { error: error.message });
    res.end();
  }
});

export default router;
