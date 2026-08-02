import { Router, Request, Response } from 'express';
import multer from 'multer';
import { documentService } from '../services/documentService';
import { workspaceService } from '../services/workspaceService';
import { processingPipeline } from '../services/processingPipeline';
import { summarizationService } from '../services/summarizationService';
import { config } from '../config';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.uploads.maxSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    // Check both MIME type and file extension (browsers often don't send proper MIME for .md files)
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    const extMap: Record<string, boolean> = {
      '.pdf': true, '.docx': true, '.txt': true, '.md': true,
    };
    if (documentService.isSupported(file.mimetype) || extMap[ext]) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype || ext}. Supported: PDF, DOCX, TXT, MD`));
    }
  },
});

const router = Router({ mergeParams: true });

// POST /api/workspaces/:workspaceId/documents - Upload document
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  const { workspaceId } = req.params as { workspaceId: string };

  // Validate workspace exists
  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const document = await documentService.upload(
      workspaceId,
      req.file.originalname,
      req.file.mimetype,
      req.file.buffer
    );
    res.status(201).json(document);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/workspaces/:workspaceId/documents - List documents in workspace
router.get('/', (req: Request, res: Response) => {
  const { workspaceId } = req.params as { workspaceId: string };

  const workspace = workspaceService.getById(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const documents = documentService.getByWorkspace(workspaceId);
  res.json(documents);
});

// GET /api/workspaces/:workspaceId/documents/:docId - Get document detail
router.get('/:docId', (req: Request, res: Response) => {
  const { docId } = req.params as { docId: string };

  const document = documentService.getById(docId);
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(document);
});

// PUT /api/workspaces/:workspaceId/documents/:docId - Rename document
router.put('/:docId', (req: Request, res: Response) => {
  const { docId } = req.params as { docId: string };
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Document name is required' });
    return;
  }

  const document = documentService.rename(docId, name.trim());
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(document);
});

// POST /api/workspaces/:workspaceId/documents/:docId/process - Process document
router.post('/:docId/process', async (req: Request, res: Response) => {
  const { docId } = req.params as { docId: string };

  const document = documentService.getById(docId);
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  try {
    const result = await processingPipeline.processDocument(docId);
    if (result.success) {
      res.json({ message: 'Document processed successfully', chunkCount: result.chunkCount });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/workspaces/:workspaceId/documents/:docId/summarize - Summarize document
router.post('/:docId/summarize', async (req: Request, res: Response) => {
  const { docId } = req.params as { docId: string };

  try {
    const result = await summarizationService.summarizeDocument(docId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/workspaces/:workspaceId/documents/:docId - Delete document
router.delete('/:docId', (req: Request, res: Response) => {
  const { docId } = req.params as { docId: string };

  const deleted = documentService.delete(docId);
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.status(204).send();
});

export default router;
