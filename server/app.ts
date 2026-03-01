import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { initDb } from './db/index';
import { createAuth } from './middleware/auth';
import { createAnnouncementsRouter } from './routes/announcements.routes';
import { createRoomsRouter } from './routes/rooms.routes';
import { createLegacyRouter } from './routes/legacy.routes';
import { AppContext } from './types';
import { createRpRouter } from './rp.routes';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  const db = initDb();
  const auth = createAuth(db);
  const ctx: AppContext = { db, auth };

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 你原有 RP 路由
  app.use('/api', createRpRouter(db));

  // 新拆分路由
  app.use('/api', createAnnouncementsRouter(ctx));
  app.use('/api', createRoomsRouter(ctx));

  // 旧业务（先整体迁移，不影响线上）
  app.use('/api', createLegacyRouter(ctx));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        let template = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) return res.status(404).json({ message: 'API not found' });
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((_req, res) => res.status(404).json({ message: 'Not Found' }));
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('[boot] /api announcements mounted');
    console.log('[boot] /api rooms mounted');
  });
}
