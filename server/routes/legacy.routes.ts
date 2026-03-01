import { Router } from 'express';
import { AppContext } from '../types';
import { resolveInitialHome } from '../utils/common';

type HomeLoc = 'sanctuary' | 'slums' | 'rich_area';

/** 职位 -> 自动迁居地点（可按你后续职位继续补充） */
function resolveHomeByJob(jobName: string): HomeLoc | null {
  const j = String(jobName || '').trim();

  // 圣所
  if (['圣所幼崽', '圣所保育员', '圣所职工'].includes(j)) return 'sanctuary';

  // 西市
  if (['西区技工', '西区副市长', '西区市长'].includes(j)) return 'slums';

  // 东市
  if (['东区贵族', '东区副市长', '东区市长'].includes(j)) return 'rich_area';

  // 其它阵营职位：先不强制迁居（保留当前 homeLocation）
  return null;
}

export function createLegacyRouter(ctx: AppContext) {
  const r = Router();
  const { db, auth } = ctx;

  /**
   * 加入/晋升职位 + 自动迁居
   * 前端目前是 body: { userId, jobName }
   */
  r.post('/tower/join', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      const jobName = String(req.body?.jobName || '').trim();

      if (!Number.isFinite(userId) || !jobName) {
        return res.status(400).json({ success: false, message: 'userId/jobName 无效' });
      }

      const u = db.prepare(`
        SELECT id, name, age, gold, role, job, homeLocation
        FROM users
        WHERE id = ?
      `).get(userId) as any;

      if (!u) return res.status(404).json({ success: false, message: '用户不存在' });

      // ====== 你原本的资质/年龄校验应放这里（如已有逻辑请并回去）======

      // 1) 更新职位
      db.prepare(`
        UPDATE users
        SET job = ?
        WHERE id = ?
      `).run(jobName, userId);

      // 2) 自动迁居逻辑
      let nextHome: HomeLoc | null = resolveHomeByJob(jobName);

      // 若职位不在三图映射内，给个兜底：
      // 未分化或未成年 -> sanctuary；否则保持原住址（若空则按金币规则）
      if (!nextHome) {
        if (String(u.role || '') === '未分化' || Number(u.age || 0) < 16) {
          nextHome = 'sanctuary';
        } else {
          const oldHome = String(u.homeLocation || '');
          if (oldHome === 'sanctuary' || oldHome === 'slums' || oldHome === 'rich_area') {
            nextHome = oldHome as HomeLoc;
          } else {
            nextHome = resolveInitialHome(Number(u.age || 18), Number(u.gold || 0)) as HomeLoc;
          }
        }
      }

      db.prepare(`UPDATE users SET homeLocation = ? WHERE id = ?`).run(nextHome, userId);

      return res.json({
        success: true,
        message: `就任成功：${jobName}，家园已迁至 ${nextHome}`,
        data: { userId, jobName, homeLocation: nextHome }
      });
    } catch (e: any) {
      console.error('[tower/join] failed:', e);
      return res.status(500).json({ success: false, message: e?.message || '加入失败' });
    }
  });

  // 可选：辞职（保留你原有逻辑时可删）
  r.post('/tower/quit', (req, res) => {
    try {
      const userId = Number(req.body?.userId);
      if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'userId 无效' });

      db.prepare(`UPDATE users SET job='无' WHERE id=?`).run(userId);
      return res.json({ success: true, message: '已辞职' });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e?.message || '辞职失败' });
    }
  });

  return r;
}
