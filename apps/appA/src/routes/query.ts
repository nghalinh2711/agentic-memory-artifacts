import { Router, Request, Response } from 'express';
import { ragQueryEngine } from '../services/ragQueryEngine';
import { workspaceService } from '../services/workspaceService';
import { summarizationService } from '../services/summarizationService';
import { comparisonService } from '../services/comparisonService';

const router = Router({ mergeParams: true });

// POST /api/workspaces/:workspaceId/summarize - Summarize workspace
router.post('/summarize', async (req: Request, res: Response) => {
  const { workspaceId } = req.params as { workspaceId: string };

  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  try {
    const result = await summarizationService.summarizeWorkspace(workspaceId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workspaces/:workspaceId/compare - Compare documents
router.post('/compare', async (req: Request, res: Response) => {
  const { workspaceId } = req.params as { workspaceId: string };
  const { documentIds } = req.body;

  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
    res.status(400).json({ error: 'At least one document ID is required' });
    return;
  }

  try {
    const result = await comparisonService.compareDocuments(workspaceId, documentIds);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workspaces/:workspaceId/query - RAG query
router.post('/query', async (req: Request, res: Response) => {
  const { workspaceId } = req.params as { workspaceId: string };
  const { question, topK } = req.body;

  // Validate workspace
  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  try {
    const result = await ragQueryEngine.query(
      question.trim(),
      workspaceId,
      topK || 5
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
