import { Router, Request, Response } from 'express';
import path from 'path';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.resolve('public/index.html'));
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
