import { Router, Request, Response } from 'express';
import { workspaceService } from '../services/workspaceService';

const router = Router();

// POST /api/workspaces - Create a new workspace
router.post('/', (req: Request, res: Response) => {
  const { name, description } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }

  const workspace = workspaceService.create(name.trim(), description || '');
  res.status(201).json(workspace);
});

// GET /api/workspaces - List all workspaces
router.get('/', (_req: Request, res: Response) => {
  const workspaces = workspaceService.getAll();
  res.json(workspaces);
});

// GET /api/workspaces/:id - Get a single workspace
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const workspace = workspaceService.getById(id);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json(workspace);
});

// PUT /api/workspaces/:id - Update (rename) a workspace
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { name, description } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Workspace name is required' });
    return;
  }

  const workspace = workspaceService.update(id, name.trim(), description);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json(workspace);
});

// DELETE /api/workspaces/:id - Delete a workspace (cascade)
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const deleted = workspaceService.delete(id);
  if (!deleted) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.status(204).send();
});

export default router;
