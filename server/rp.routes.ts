import express from 'express';
import Database from 'better-sqlite3';

type RPMessageRow = {
  id: number;
  sessionId: string;
  senderId: number | null;
  senderName: string;
  senderAvatar?: string | null; // 新增
  content: string;
  type: 'user' | 'system' | 'text';
  createdAt: string;
};

type MemberRow = {
  sessionId: string;
  userId: number;
  userName: string;
  role: string;
};

type SessionRow = {
  id: string;
  locationId: string;
  locationName: string;
  status: 'active' | 'closed' | 'ending' | 'mediating';
  endProposedBy: number | null;
};

const now = () => new Date().toISOString();

function toSafeUserId(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function mapSessionShape(session: SessionRow, members: MemberRow[]) {
  const mA = members[0];
  const mB = members[1];
  return {
    sessionId: session.id,
    userAId: mA?.userId ?? 0,
    userAName: mA?.userName ?? '未知A',
    userBId: mB?.userId ?? 0,
    userBName: mB?.userName ?? '未知B',
    locationId: session.locationId,
    locationName: session.locationName,
    status: session.status,
    createdAt: null,
    updatedAt: null
  };
}

function getBearerToken(req: any) {
  const h = (req.headers?.authorization || '').trim();
  if (!h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}

export function createRpRouter(db: Database.Database) {
  const router = express.Router();

  // 管理员鉴权（用于后台档案读取/删除）
  const requireAdminAuth = (req: any, res: express.Response, next: express.NextFunction) => {
    try {
      const token = getBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, message: '缺少管理员令牌' });
      }

      const s = db
        .prepare(
          `SELECT userId, userName, role, revokedAt
           FROM user_sessions
           WHERE token = ?
           LIMIT 1`
        )
        .get(token) as any;

      if (!s || s.revokedAt || s.role !== 'admin') {
        return res.status(401).json({ success: false, message: '管理员会话失效' });
      }

      db.prepare(`UPDATE user_sessions SET lastSeenAt = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
      req.admin = { userId: Number(s.userId), name: s.userName, token };
      next();
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '鉴权失败' });
    }
  };

  // 1) 建立/续用会话（前端先开窗，这里异步 upsert）
  router.post('/rp/session/upsert', (req, res) => {
    try {
      const { sessionId, userAId, userAName, userBId, userBName, locationId, locationName } = req.body || {};

      const aId = toSafeUserId(userAId);
      const bId = toSafeUserId(userBId);

      if (!sessionId || !aId || !bId) {
        return res.status(400).json({ success: false, message: '参数不完整' });
      }
      if (aId === bId) {
        return res.status(400).json({ success: false, message: '会话双方不能是同一人' });
      }

      const getSession = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ?`);
      const oldSession = getSession.get(sessionId) as SessionRow | undefined;

      const tx = db.transaction(() => {
        if (!oldSession) {
          db.prepare(`
            INSERT INTO active_rp_sessions (id, locationId, locationName, status, endProposedBy)
            VALUES (?, ?, ?, 'active', NULL)
          `).run(sessionId, locationId || 'unknown', locationName || '未知区域');

          db.prepare(`
            INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
            VALUES (?, ?, ?, ?, ?)
          `).run(sessionId, 0, '系统', '对戏已建立连接。', 'system');
        } else {
          db.prepare(`
            UPDATE active_rp_sessions
            SET status = 'active',
                endProposedBy = NULL,
                locationId = ?,
                locationName = ?
            WHERE id = ?
          `).run(
            locationId || oldSession.locationId || 'unknown',
            locationName || oldSession.locationName || '未知区域',
            sessionId
          );
        }

        // 无论新旧都补齐成员（防止成员表意外缺行）
        db.prepare(`
          INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role)
          VALUES (?, ?, ?, ?)
        `).run(sessionId, aId, userAName || `U${aId}`, '未知');

        db.prepare(`
          INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role)
          VALUES (?, ?, ?, ?)
        `).run(sessionId, bId, userBName || `U${bId}`, '未知');

        // 重新激活时清空离场记录
        db.prepare(`DELETE FROM active_rp_leaves WHERE sessionId = ?`).run(sessionId);
      });

      tx();
      return res.json({ success: true, sessionId });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || 'upsert失败' });
    }
  });

  // 2) 获取某用户当前活跃会话
  router.get('/rp/session/active/:userId', (req, res) => {
    try {
      const userId = toSafeUserId(req.params.userId);
      if (!userId) return res.status(400).json({ success: false, message: 'userId 非法' });

      const row = db.prepare(`
        SELECT s.*
        FROM active_rp_sessions s
        JOIN active_rp_members m ON m.sessionId = s.id
        WHERE m.userId = ? AND s.status = 'active'
        ORDER BY s.id DESC
        LIMIT 1
      `).get(userId) as SessionRow | undefined;

      if (!row) return res.json({ success: true, sessionId: null, session: null });

      const members = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ?
        ORDER BY userId ASC
      `).all(row.id) as MemberRow[];

      return res.json({
        success: true,
        sessionId: row.id,
        session: mapSessionShape(row, members)
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '查询失败' });
    }
  });

  // 3) 拉会话+消息（RoleplayWindow用）
  router.get('/rp/session/:sessionId/messages', (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const session = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ?`).get(sessionId) as SessionRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: '会话不存在' });

      const members = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ?
        ORDER BY userId ASC
      `).all(sessionId) as MemberRow[];

      const messages = db.prepare(`
        SELECT
          m.id, m.sessionId, m.senderId, m.senderName, m.content, m.type, m.createdAt,
          u.avatarUrl as senderAvatar
        FROM active_rp_messages m
        LEFT JOIN users u ON u.id = m.senderId
        WHERE m.sessionId = ?
        ORDER BY m.id ASC
      `).all(sessionId) as RPMessageRow[];

      return res.json({
        success: true,
        session: mapSessionShape(session, members),
        messages
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '拉取失败' });
    }
  });

  // 4) 发消息
  router.post('/rp/session/:sessionId/messages', (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { senderId, senderName, content } = req.body || {};

      const text = String(content ?? '').trim();
      if (!text) {
        return res.status(400).json({ success: false, message: '消息不能为空' });
      }

      const sid = toSafeUserId(senderId);
      if (!sid) {
        return res.status(400).json({ success: false, message: 'senderId 非法' });
      }

      const exists = db.prepare(`
        SELECT id, status
        FROM active_rp_sessions
        WHERE id = ?
      `).get(sessionId) as SessionRow | undefined;

      if (!exists) return res.status(404).json({ success: false, message: '会话不存在' });
      if (exists.status !== 'active') return res.status(400).json({ success: false, message: '会话已结束' });

      const member = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ? AND userId = ?
      `).get(sessionId, sid) as MemberRow | undefined;

      if (!member) {
        return res.status(403).json({ success: false, message: '你不在该会话中' });
      }

      db.prepare(`
        INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
        VALUES (?, ?, ?, ?, 'user')
      `).run(sessionId, sid, senderName || member.userName || `U${sid}`, text);

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '发送失败' });
    }
  });

  // 5) 离开会话：双方都离开 => 归档到 rp_archives + rp_archive_messages
  router.post('/rp/session/:sessionId/leave', (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const { userId, userName } = req.body || {};
      const uid = toSafeUserId(userId);

      if (!uid) {
        return res.status(400).json({ success: false, message: 'userId 非法' });
      }

      const session = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ?`).get(sessionId) as SessionRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: '会话不存在' });

      // 已关闭就直接返回，防止重复归档
      if (session.status === 'closed') {
        return res.json({ success: true, closed: true, message: '会话已归档' });
      }

      const member = db.prepare(`
        SELECT * FROM active_rp_members
        WHERE sessionId = ? AND userId = ?
      `).get(sessionId, uid) as MemberRow | undefined;

      if (!member) {
        return res.status(403).json({ success: false, message: '你不在该会话中' });
      }

      const tx = db.transaction(() => {
        const alreadyLeft = db.prepare(`
          SELECT 1 FROM active_rp_leaves
          WHERE sessionId = ? AND userId = ?
        `).get(sessionId, uid);

        db.prepare(`
          INSERT OR REPLACE INTO active_rp_leaves (sessionId, userId, leftAt)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(sessionId, uid);

        // 避免同一人重复点离开刷系统消息
        if (!alreadyLeft) {
          db.prepare(`
            INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
            VALUES (?, 0, '系统', ?, 'system')
          `).run(sessionId, `${userName || member.userName || `U${uid}`} 离开了对戏`);
        }

        const memberCount = (db.prepare(`
          SELECT COUNT(*) as c
          FROM active_rp_members
          WHERE sessionId = ?
        `).get(sessionId) as any).c as number;

        // 只统计“既在 leave 表又在 members 表”的用户
        const leaveCount = (db.prepare(`
          SELECT COUNT(*) as c
          FROM active_rp_leaves l
          JOIN active_rp_members m
            ON m.sessionId = l.sessionId
           AND m.userId = l.userId
          WHERE l.sessionId = ?
        `).get(sessionId) as any).c as number;

        if (memberCount > 0 && leaveCount >= memberCount) {
          db.prepare(`UPDATE active_rp_sessions SET status = 'closed' WHERE id = ?`).run(sessionId);

          const members = db.prepare(`
            SELECT * FROM active_rp_members
            WHERE sessionId = ?
            ORDER BY userId ASC
          `).all(sessionId) as MemberRow[];

          const msgs = db.prepare(`
            SELECT senderId, senderName, content, type, createdAt
            FROM active_rp_messages
            WHERE sessionId = ?
            ORDER BY id ASC
          `).all(sessionId) as Array<{
            senderId: number | null;
            senderName: string;
            content: string;
            type: string;
            createdAt: string;
          }>;

          const participantIds = JSON.stringify(members.map((m) => m.userId));
          const participantNames = members.map((m) => m.userName).join(', ');
          // 用稳定 ID 防止重复归档
          const archiveId = `ARC-${sessionId}`;

          const arcExists = db.prepare(`SELECT 1 FROM rp_archives WHERE id = ?`).get(archiveId);
          if (!arcExists) {
            db.prepare(`
              INSERT INTO rp_archives
              (id, title, locationId, locationName, participants, participantNames, status, createdAt)
              VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
            `).run(
              archiveId,
              `${session.locationName || '未知地点'} 对戏存档`,
              session.locationId || 'unknown',
              session.locationName || '未知地点',
              participantIds,
              participantNames,
              now()
            );

            const ins = db.prepare(`
              INSERT INTO rp_archive_messages (archiveId, senderId, senderName, content, type, createdAt)
              VALUES (?, ?, ?, ?, ?, ?)
            `);

            msgs.forEach((m) => {
              ins.run(archiveId, m.senderId ?? 0, m.senderName || '未知', m.content || '', m.type || 'text', m.createdAt || now());
            });
          }
        }
      });

      tx();

      const closed = (db.prepare(`SELECT status FROM active_rp_sessions WHERE id = ?`).get(sessionId) as any)?.status === 'closed';
      return res.json({ success: true, closed });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '离开失败' });
    }
  });

  // 6) 后台档案读取（仅管理员）
  router.get('/admin/rp_archives', requireAdminAuth, (_req, res) => {
    try {
      const archives = db.prepare(`
        SELECT * FROM rp_archives
        ORDER BY createdAt DESC
      `).all() as any[];

      for (const arc of archives) {
        arc.messages = db.prepare(`
          SELECT * FROM rp_archive_messages
          WHERE archiveId = ?
          ORDER BY createdAt ASC, id ASC
        `).all(arc.id);
      }

      return res.json({ success: true, archives });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '读取归档失败' });
    }
  });

  // 7) 后台删除单条对戏存档（仅管理员）
  router.delete('/admin/rp_archives/:archiveId', requireAdminAuth, (req, res) => {
    try {
      const archiveId = decodeURIComponent(String(req.params.archiveId || '')).trim();
      if (!archiveId) {
        return res.status(400).json({ success: false, message: 'archiveId 必填' });
      }

      const tx = db.transaction((id: string) => {
        db.prepare(`DELETE FROM rp_archive_messages WHERE archiveId = ?`).run(id);
        const ret = db.prepare(`DELETE FROM rp_archives WHERE id = ?`).run(id);
        return Number(ret.changes || 0);
      });

      const changes = tx(archiveId);
      if (changes <= 0) {
        return res.status(404).json({ success: false, message: '存档不存在或已删除' });
      }

      return res.json({ success: true, message: `存档 ${archiveId} 已删除` });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '删除失败' });
    }
  });

  return router;
}
