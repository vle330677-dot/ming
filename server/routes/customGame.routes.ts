import { Router } from 'express';

export function createCustomGameRouter(_db: any) {
  const router = Router();

  // 健康检查
  router.get('/health', (_req, res) => {
    res.json({ success: true, module: 'custom-games', status: 'ok' });
  });

  // 临时兜底：避免主服务因模块缺失崩溃
  router.all('*', (_req, res) => {
    res.status(503).json({
      success: false,
      message: 'custom game router is temporarily unavailable'
    });
  });

  return router;
}
