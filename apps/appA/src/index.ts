import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initializeDatabase } from './models';
import { vectorStore } from './services';
import routes from './routes';
import workspaceRoutes from './routes/workspaces';
import documentRoutes from './routes/documents';
import queryRoutes from './routes/query';
import conversationRoutes from './routes/conversations';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static('public'));

  // Routes
  app.use('/', routes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/workspaces/:workspaceId/documents', documentRoutes);
app.use('/api/workspaces/:workspaceId', queryRoutes);
app.use('/api/workspaces/:workspaceId/conversations', conversationRoutes);

  // Global error handler — ensures all errors return JSON, never HTML
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Server error:', err.message || err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}

// Initialize and start
async function start() {
  // Initialize SQLite database
  initializeDatabase();

  // Initialize vector store
  await vectorStore.initialize();

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`🚀 AI RAG Chatbot server running at http://localhost:${config.port}`);
    console.log(`📋 Environment: ${config.nodeEnv}`);
  });
}

// Only start if this is the main module
if (require.main === module || process.argv[1]?.includes('index')) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
