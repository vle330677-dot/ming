import { Router } from 'express';
import { AppContext } from '../types';
import { getRoomEntrancePos } from '../utils/common';
import { verifyPassword, hashPassword } from '../middleware/auth';

const ROOM_ZONES = new Set(['sanctuary', 'slums', 'rich_area'] as const);

function resolveHomeByRule(age: number, gold: number, role?: string): 'sanctuary' | 'slums' | 'rich_area' {
  // 未分化者 / 未满16岁：固定圣所
  if (String(role || '') === '未分化' || Number(age || 0) < 16) return 'sanctuary';
  // 非未分化且 >=16：按金币
  return Number(gold || 0) > 9999 ? 'rich_area' : 'slums';
}

function toInt01(v: any): 0 | 1 | null {
  if (v === undefined || v === null) return null;
  return !!v ? 1 : 0;
}

export function createRoomsRouter(ctx: AppContext) {
  const r = Router();
  const { db, auth } = ctx;

  // 轻量迁移：新增 roomVisible（若不存在）
  try {
    db.exec(`ALTER TABLE users ADD COLUMN roomVisible INTEGER DEFAULT 1`);
  } catch {
    // ignore duplicate column
  }
  try {
    db.exec(`UPDATE users SET roomVisible = 1 WHERE roomVisible IS NULL`);
  } catch {
    // ignore
  }

  // 初始化房间（幂等）
  r.post('/rooms/init', (req, res) => {
    const userId = Number(req.body?.userId);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'userId 无效' });

    const u = db.prepare(`
      SELECT id, age, gold, role, homeLocation, allowVisit, roomVisible, roomBgImage, roomDescription
      FROM users WHERE id=?
    `).get(userId) as any;

    if (!u) return res.status(404).json({ success: false, message: '用户不存在' });

    let home = String(u.homeLocation || '');
    const shouldForceSanctuary = String(u.role || '') === '未分化' || Number(u.age || 0) < 16;

    // 如果 home 无效，按规则初始化
    if (!ROOM_ZONES.has(home as any)) {
      home = resolveHomeByRule(Number(u.age || 18), Number(u.gold || 0), String(u.role || ''));
      db.prepare(`UPDATE users SET homeLocation=? WHERE id=?`).run(home, userId);
    } else if (shouldForceSanctuary && home !== 'sanctuary') {
      // 未分化/未成年强制圣所
      home = 'sanctuary';
      db.prepare(`UPDATE users SET homeLocation=? WHERE id=?`).run(home, userId);
    }

    // 默认访问、可见开关
    if (u.allowVisit === null || u.allowVisit === undefined) {
      db.prepare(`UPDATE users SET allowVisit=1 WHERE id=?`).run(userId);
    }
    if (u.roomVisible === null || u.roomVisible === undefined) {
      db.prepare(`UPDATE users SET roomVisible=1 WHERE id=?`).run(userId);
    }

    res.json({ success: true, homeLocation: home });
  });

  // 某区域房间入口（锁门也显示，点进去可看信息）
  r.get('/rooms/entrances', (req, res) => {
    const locationId = String(req.query.locationId || '').trim();
    const viewerId = Number(req.query.viewerId || 0);
    if (!ROOM_ZONES.has(locationId as any)) return res.json({ success: true, rows: [] });

    const rows = db.prepare(`
      SELECT id, name, avatarUrl, job, role, homeLocation, allowVisit, roomVisible, roomDescription
      FROM users
      WHERE homeLocation = ?
        AND status IN ('approved','ghost')
      ORDER BY id DESC
    `).all(locationId) as any[];

    const result = rows
      .filter((u) => {
        const isSelf = Number(u.id) === viewerId;
        const visible = Number(u.roomVisible ?? 1) === 1;
        // 非自己且未公开 -> 不显示入口
        return isSelf || visible;
      })
      .map((u) => {
        const isSelf = Number(u.id) === viewerId;
        const allowVisit = Number(u.allowVisit ?? 1) === 1;
        const pos = getRoomEntrancePos(
  String(u.homeLocation || locationId),
  String(u.job || ''),
  Number(u.id),
  { x: 50, y: 50 }
);

        return {
          ownerId: u.id,
          ownerName: u.name,
          avatarUrl: u.avatarUrl || '',
          job: u.job || '',
          role: u.role || '',
          locationId: u.homeLocation,
          intro: u.roomDescription || '',
          x: pos.x,
          y: pos.y,
          locked: !isSelf && !allowVisit
        };
      });

    res.json({ success: true, rows: result });
  });

  // 房间详情（锁门可看简介；是否可进入由 canEnter 决定）
  r.get('/rooms/:ownerId', auth.requireUserAuth, (req: any, res) => {
    const ownerId = Number(req.params.ownerId);
    const viewerId = Number(req.user.id);

    const owner = db.prepare(`
      SELECT id, name, avatarUrl, job, role, homeLocation, roomBgImage, roomDescription, allowVisit, roomVisible
      FROM users WHERE id=?
    `).get(ownerId) as any;

    if (!owner) return res.status(404).json({ success: false, message: '房主不存在' });

    const isSelf = ownerId === viewerId;
    const visible = Number(owner.roomVisible ?? 1) === 1;
    if (!isSelf && !visible) {
      return res.status(403).json({ success: false, message: '房主未公开房间' });
    }

    const allowVisit = Number(owner.allowVisit ?? 1) === 1;
    const canEnter = isSelf || allowVisit;

    res.json({
      success: true,
      room: {
        ownerId: owner.id,
        ownerName: owner.name,
        avatarUrl: owner.avatarUrl || '',
        job: owner.job || '',
        role: owner.role || '',
        homeLocation: owner.homeLocation || '',
        bgImage: owner.roomBgImage || '',
        description: owner.roomDescription || '',
        visible,
        allowVisit,
        canEnter
      },
      isSelf
    });
  });

  // 进入房间（锁门时可携带 password 直接校验）
  r.post('/rooms/:ownerId/enter', auth.requireUserAuth, async (req: any, res) => {
    const ownerId = Number(req.params.ownerId);
    const viewerId = Number(req.user.id);
    const inputPassword = String(req.body?.password || '');

    const owner = db.prepare(`
      SELECT id, name, homeLocation, allowVisit, roomVisible, roomPasswordHash
      FROM users WHERE id=?
    `).get(ownerId) as any;

    if (!owner) return res.status(404).json({ success: false, message: '房主不存在' });

    const isSelf = ownerId === viewerId;
    const visible = Number(owner.roomVisible ?? 1) === 1;
    if (!isSelf && !visible) {
      return res.status(403).json({ success: false, message: '房主未公开房间' });
    }

    const allowVisit = Number(owner.allowVisit ?? 1) === 1;
    if (!isSelf && !allowVisit) {
      // 房主锁门：需要密码
      if (!owner.roomPasswordHash) {
        return res.status(403).json({ success: false, message: '房间已上锁' });
      }
      const ok = await verifyPassword(inputPassword, owner.roomPasswordHash);
      if (!ok) return res.status(403).json({ success: false, message: '密码错误，无法进入' });
    }

    res.json({
      success: true,
      message: `已进入 ${owner.name} 的房间`,
      owner: {
        id: owner.id,
        name: owner.name,
        homeLocation: owner.homeLocation
      }
    });
  });

  // 设置房间（房主自己）
  r.put('/rooms/:ownerId', auth.requireUserAuth, async (req: any, res) => {
    const ownerId = Number(req.params.ownerId);
    const uid = Number(req.user.id);
    if (ownerId !== uid) return res.status(403).json({ success: false, message: '无权限' });

    const {
      visible,          // 房间是否公开展示
      allowVisit,       // 是否允许访客进入
      roomDescription,
      roomBgImage,
      roomPassword,
      clearRoomPassword
    } = req.body || {};

    const visible01 = toInt01(visible);
    const allowVisit01 = toInt01(allowVisit);

    let roomHash: string | null = null;
    if (typeof roomPassword === 'string' && roomPassword.length > 0) {
      roomHash = await hashPassword(String(roomPassword));
    }

    // 先更新基础字段
    db.prepare(`
      UPDATE users
      SET roomVisible = COALESCE(?, roomVisible),
          allowVisit = COALESCE(?, allowVisit),
          roomDescription = ?,
          roomBgImage = ?
      WHERE id = ?
    `).run(
      visible01,
      allowVisit01,
      roomDescription ?? null,
      roomBgImage ?? null,
      ownerId
    );

    // 密码单独处理（支持清空）
    if (clearRoomPassword) {
      db.prepare(`UPDATE users SET roomPasswordHash = NULL WHERE id = ?`).run(ownerId);
    } else if (roomHash) {
      db.prepare(`UPDATE users SET roomPasswordHash = ? WHERE id = ?`).run(roomHash, ownerId);
    }

    res.json({ success: true });
  });

  // 验证房间密码
  r.post('/rooms/:ownerId/verify-password', async (req, res) => {
    const ownerId = Number(req.params.ownerId);
    const password = String(req.body?.password || '');

    const owner = db.prepare(`SELECT roomPasswordHash FROM users WHERE id=?`).get(ownerId) as any;
    if (!owner) return res.status(404).json({ success: false, message: '房主不存在' });
    if (!owner.roomPasswordHash) return res.json({ success: true, pass: true });

    const ok = await verifyPassword(password, owner.roomPasswordHash);
    res.json({ success: true, pass: ok });
  });

  return r;
}
