import express from 'express';
import Database from 'better-sqlite3';

type RPMessageRow = {
  id: number;
  sessionId: string;
  senderId: number | null;
  senderName: string;
  content: string;
  type: 'user' | 'system';
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
const genId = (prefix = 'ID') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

export function createRpRouter(db: Database.Database) {
  const router = express.Router();

  // 1) 建立/续用会话（前端先开窗，这里异步 upsert）
  router.post('/rp/session/upsert', (req, res) => {
    try {
      const {
        sessionId,
        userAId, userAName,
        userBId, userBName,
        locationId, locationName
      } = req.body || {};

      if (!sessionId || !userAId || !userBId) {
        return res.status(400).json({ success: false, message: '参数不完整' });
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
            INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role)
            VALUES (?, ?, ?, ?)
          `).run(sessionId, userAId, userAName || `U${userAId}`, '未知');

          db.prepare(`
            INSERT OR IGNORE INTO active_rp_members (sessionId, userId, userName, role)
            VALUES (?, ?, ?, ?)
          `).run(sessionId, userBId, userBName || `U${userBId}`, '未知');

          db.prepare(`
            INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
            VALUES (?, ?, ?, ?, ?)
          `).run(sessionId, 0, '系统', '对戏已建立连接。', 'system');
        } else {
          db.prepare(`
            UPDATE active_rp_sessions
            SET status = 'active', endProposedBy = NULL, locationId = ?, locationName = ?
            WHERE id = ?
          `).run(locationId || oldSession.locationId, locationName || oldSession.locationName, sessionId);
        }

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
      const userId = Number(req.params.userId);
      const row = db.prepare(`
        SELECT s.*
        FROM active_rp_sessions s
        JOIN active_rp_members m ON m.sessionId = s.id
        WHERE m.userId = ? AND s.status = 'active'
        ORDER BY s.id DESC
        LIMIT 1
      `).get(userId) as SessionRow | undefined;

      if (!row) return res.json({ success: true, sessionId: null, session: null });

      const members = db.prepare(`SELECT * FROM active_rp_members WHERE sessionId = ? ORDER BY userId ASC`).all(row.id) as MemberRow[];
      return res.json({ success: true, sessionId: row.id, session: mapSessionShape(row, members) });
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

      const members = db.prepare(`SELECT * FROM active_rp_members WHERE sessionId = ? ORDER BY userId ASC`).all(sessionId) as MemberRow[];
      const messages = db.prepare(`
        SELECT id, sessionId, senderId, senderName, content, type, createdAt
        FROM active_rp_messages
        WHERE sessionId = ?
        ORDER BY id ASC
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
      if (!content || !String(content).trim()) {
        return res.status(400).json({ success: false, message: '消息不能为空' });
      }

      const exists = db.prepare(`SELECT id, status FROM active_rp_sessions WHERE id = ?`).get(sessionId) as SessionRow | undefined;
      if (!exists) return res.status(404).json({ success: false, message: '会话不存在' });
      if (exists.status !== 'active') return res.status(400).json({ success: false, message: '会话已结束' });

      db.prepare(`
        INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
        VALUES (?, ?, ?, ?, 'user')
      `).run(sessionId, Number(senderId), senderName || `U${senderId}`, String(content));

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
      const uid = Number(userId);

      const session = db.prepare(`SELECT * FROM active_rp_sessions WHERE id = ?`).get(sessionId) as SessionRow | undefined;
      if (!session) return res.status(404).json({ success: false, message: '会话不存在' });

      const tx = db.transaction(() => {
        db.prepare(`
          INSERT OR REPLACE INTO active_rp_leaves (sessionId, userId, leftAt)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(sessionId, uid);

        db.prepare(`
          INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type)
          VALUES (?, 0, '系统', ?, 'system')
        `).run(sessionId, `${userName || `U${uid}`} 离开了对戏`);

        const memberCount = (db.prepare(`SELECT COUNT(*) as c FROM active_rp_members WHERE sessionId = ?`).get(sessionId) as any).c as number;
        const leaveCount = (db.prepare(`SELECT COUNT(*) as c FROM active_rp_leaves WHERE sessionId = ?`).get(sessionId) as any).c as number;

        if (memberCount > 0 && leaveCount >= memberCount) {
          // 关会话
          db.prepare(`UPDATE active_rp_sessions SET status = 'closed' WHERE id = ?`).run(sessionId);

          // 读会话成员与消息
          const members = db.prepare(`SELECT * FROM active_rp_members WHERE sessionId = ? ORDER BY userId ASC`).all(sessionId) as MemberRow[];
          const msgs = db.prepare(`
            SELECT senderId, senderName, content, type, createdAt
            FROM active_rp_messages WHERE sessionId = ? ORDER BY id ASC
          `).all(sessionId) as any[];

          const participantIds = JSON.stringify(members.map(m => m.userId));
          const participantNames = members.map(m => m.userName).join(', ');
          const archiveId = genId('ARC');

          db.prepare(`
            INSERT INTO rp_archives (id, title, locationId, locationName, participants, participantNames, status, createdAt)
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
      });

      tx();

      const closed = (db.prepare(`SELECT status FROM active_rp_sessions WHERE id = ?`).get(sessionId) as any)?.status === 'closed';
      return res.json({ success: true, closed });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '离开失败' });
    }
  });

  // 6) 后台档案读取（兼容你 AdminView）
  router.get('/admin/rp_archives', (_req, res) => {
    try {
      const archives = db.prepare('SELECT * FROM rp_archives ORDER BY createdAt DESC').all() as any[];
      for (const arc of archives) {
        arc.messages = db.prepare('SELECT * FROM rp_archive_messages WHERE archiveId = ? ORDER BY createdAt ASC').all(arc.id);
      }
      return res.json({ success: true, archives });
    } catch (e: any) {
      return res.status(500).json({ success: false, message: e.message || '读取归档失败' });
    }
  });

  return router;
}