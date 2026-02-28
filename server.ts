import express from 'express';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRpRouter } from './server/rp.routes';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server.ts
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'game.db');

// 【修复1】确保数据库存放的目录存在，避免新项目启动时直接崩溃
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

// 启用 WAL 模式，提升 SQLite 高并发读写性能，避免 Database is locked
db.pragma('journal_mode = WAL');

// ================= 1. 数据库初始化 =================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    age INTEGER DEFAULT 18,
    role TEXT,
    faction TEXT,
    mentalRank TEXT,
    physicalRank TEXT,
    gold INTEGER DEFAULT 0,
    ability TEXT,
    spiritName TEXT,
    spiritType TEXT,
    avatarUrl TEXT,
    status TEXT DEFAULT 'pending',
    deathDescription TEXT,
    profileText TEXT,
    isHidden INTEGER DEFAULT 0,
    currentLocation TEXT,
    job TEXT DEFAULT '无',
    hp INTEGER DEFAULT 100,
    maxHp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 100,
    maxMp INTEGER DEFAULT 100,
    mentalProgress REAL DEFAULT 0,
    workCount INTEGER DEFAULT 0,
    trainCount INTEGER DEFAULT 0,
    lastResetDate TEXT,
    lastCheckInDate TEXT,
    password TEXT,
    roomBgImage TEXT,
    roomDescription TEXT,
    allowVisit INTEGER DEFAULT 1,
    fury INTEGER DEFAULT 0,
    partyId TEXT DEFAULT NULL
  );

  -- ===== RP 会话系统（拆分路由用）=====
  CREATE TABLE IF NOT EXISTS active_rp_sessions (
    id TEXT PRIMARY KEY,
    locationId TEXT,
    locationName TEXT,
    status TEXT DEFAULT 'active',
    endProposedBy INTEGER DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS active_rp_members (
    sessionId TEXT,
    userId INTEGER,
    userName TEXT,
    role TEXT,
    PRIMARY KEY (sessionId, userId)
  );

  CREATE TABLE IF NOT EXISTS active_rp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId TEXT,
    senderId INTEGER,
    senderName TEXT,
    content TEXT,
    type TEXT DEFAULT 'text',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS active_rp_leaves (
    sessionId TEXT,
    userId INTEGER,
    leftAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sessionId, userId)
  );

  CREATE TABLE IF NOT EXISTS player_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ownerId INTEGER,
    targetId INTEGER,
    content TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ownerId, targetId)
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    leaderId INTEGER,
    status TEXT DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS team_members (
    teamId TEXT,
    userId INTEGER,
    status TEXT DEFAULT 'pending',
    PRIMARY KEY (teamId, userId)
  );

  CREATE TABLE IF NOT EXISTS rp_archives (
    id TEXT PRIMARY KEY,
    title TEXT,
    locationId TEXT,
    locationName TEXT,
    participants TEXT,
    participantNames TEXT,
    status TEXT DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rp_archive_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archiveId TEXT,
    senderId INTEGER,
    senderName TEXT,
    content TEXT,
    type TEXT DEFAULT 'text',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rescue_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientId INTEGER,
    healerId INTEGER,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS global_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    locationTag TEXT,
    npcId TEXT,
    price INTEGER DEFAULT 0,
    faction TEXT DEFAULT '通用',
    tier TEXT DEFAULT '低阶',
    itemType TEXT DEFAULT '回复道具',
    effectValue INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS global_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    faction TEXT,
    tier TEXT DEFAULT '低阶',
    description TEXT,
    npcId TEXT
  );

  CREATE TABLE IF NOT EXISTS tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    deathDescription TEXT,
    role TEXT,
    mentalRank TEXT,
    physicalRank TEXT,
    ability TEXT,
    spiritName TEXT,
    isHidden INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tombstone_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tombstoneId INTEGER,
    userId INTEGER,
    userName TEXT,
    content TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tombstoneId) REFERENCES tombstones(id)
  );

  CREATE TABLE IF NOT EXISTS spirit_status (
    userId INTEGER PRIMARY KEY,
    name TEXT,
    imageUrl TEXT,
    intimacy INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    hp INTEGER DEFAULT 100,
    status TEXT DEFAULT '良好',
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    qty INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS roleplay_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER,
    senderName TEXT,
    receiverId INTEGER,
    receiverName TEXT,
    content TEXT,
    locationId TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS commissions (
    id TEXT PRIMARY KEY,
    publisherId INTEGER,
    publisherName TEXT,
    title TEXT,
    content TEXT,
    difficulty TEXT,
    reward INTEGER DEFAULT 0,
    isAnonymous INTEGER DEFAULT 0,
    status TEXT DEFAULT 'open',
    acceptedById INTEGER DEFAULT NULL,
    acceptedByName TEXT DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auction_items (
    id TEXT PRIMARY KEY,
    itemId INTEGER,
    name TEXT,
    sellerId INTEGER,
    currentPrice INTEGER,
    minPrice INTEGER,
    highestBidderId INTEGER,
    status TEXT DEFAULT 'active',
    endsAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);


// 动态补全字段，添加正则校验防御 SQL 注入
const addColumn = (table: string, col: string, type: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(col)) {
    console.warn(`Invalid table or column name in addColumn: ${table}.${col}`);
    return;
  }
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch {
    // ignore duplicated column
  }
};

['age', 'hp', 'maxHp', 'mp', 'maxMp', 'workCount', 'trainCount', 'fury'].forEach((c) =>
  addColumn('users', c, 'INTEGER DEFAULT 0')
);
[
  'faction',
  'job',
  'role',
  'mentalRank',
  'physicalRank',
  'ability',
  'spiritName',
  'spiritType',
  'avatarUrl',
  'status',
  'deathDescription',
  'profileText',
  'currentLocation',
  'lastResetDate',
  'lastCheckInDate',
  'password',
  'roomBgImage',
  'roomDescription',
  'partyId'
].forEach((c) => addColumn('users', c, 'TEXT'));
addColumn('users', 'isHidden', 'INTEGER DEFAULT 0');
addColumn('users', 'mentalProgress', 'REAL DEFAULT 0');
addColumn('users', 'allowVisit', 'INTEGER DEFAULT 1');
addColumn('global_skills', 'tier', "TEXT DEFAULT '低阶'");
addColumn('roleplay_messages', 'locationId', 'TEXT');
addColumn('global_items', 'npcId', 'TEXT');
addColumn('global_skills', 'npcId', 'TEXT');
addColumn('rp_archives', 'locationName', 'TEXT');
addColumn('rp_archives', 'participantNames', 'TEXT');
addColumn('global_items', 'faction', "TEXT DEFAULT '通用'");
addColumn('global_items', 'tier', "TEXT DEFAULT '低阶'");
addColumn('global_items', 'itemType', "TEXT DEFAULT '回复道具'");
addColumn('global_items', 'effectValue', "INTEGER DEFAULT 0");

// ================= 2. 初始数据种子 =================
const seedData = () => {
  const initialSkills = [
    { name: '精神梳理', faction: '治疗系', tier: '低阶', description: '基础的精神安抚技能。' },
    { name: '五感强化', faction: '感知系', tier: '中阶', description: '短时间内极大提升战场感知力。' },
    { name: '格斗精通', faction: '物理系', tier: '低阶', description: '提升近战肉搏能力。' }
  ];

  const skillCount = db.prepare('SELECT COUNT(*) as count FROM global_skills').get() as any;
  if (skillCount.count === 0) {
    const insertSkill = db.prepare('INSERT INTO global_skills (name, faction, tier, description) VALUES (?, ?, ?, ?)');
    initialSkills.forEach((s) => insertSkill.run(s.name, s.faction, s.tier, s.description));
  }

  const initialItems = [
    { name: '过期向导素', locationTag: 'slums', price: 50, description: '效果存疑的廉价药剂。' },
    { name: '高级营养液', locationTag: 'rich_area', price: 500, description: '富人区的日常补给。' }
  ];

  const itemCount = db.prepare('SELECT COUNT(*) as count FROM global_items').get() as any;
  if (itemCount.count === 0) {
    const insertItem = db.prepare(
      'INSERT INTO global_items (name, description, locationTag, price) VALUES (?, ?, ?, ?)'
    );
    initialItems.forEach((i) => insertItem.run(i.name, i.description, i.locationTag, i.price));
  }
};
seedData();

// ================= 3. 辅助配置 =================

const LOCATION_FACTION_MAP: Record<string, string> = {
  'tower_of_life': '精神系',
  'london_tower': '元素系',
  'paranormal_office': '感知系',
  'demon_society': '信息系',
  'slums': '炼金系',     
  'rich_area': '强化系', 
  'sanctuary': '治疗系',
  'army': '物理系'
};

const JOB_SALARIES: Record<string, number> = {
  '圣子/圣女': 5000, 侍奉者: 1000, 候选者: 3000, 仆从: 500,
  伦敦塔教师: 800, 伦敦塔职工: 400, 伦敦塔学员: 100,
  圣所保育员: 500, 圣所职工: 250, 圣所幼崽: 50,
  公会会长: 2000, 公会成员: 600, 冒险者: 0,
  军队将官: 1500, 军队校官: 1000, 军队尉官: 800, 军队士兵: 500,
  西区市长: 1200, 西区副市长: 800, 西区技工: 300,
  东区市长: 3000, 东区副市长: 1500, 东区贵族: 1000,
  守塔会会长: 2500, 守塔会成员: 700,
  恶魔会会长: 1800, 恶魔会成员: 0,
  灵异所所长: 2500, 搜捕队队长: 1500, 搜捕队队员: 1000, 灵异所文员: 1000,
  观察者首领: 3000, 情报搜集员: 800, 情报处理员: 800
};

const JOB_LIMITS: Record<string, number> = {
  '圣子/圣女': 1, 侍奉者: 2, 候选者: 3, 仆从: 99999,
  伦敦塔教师: 100, 伦敦塔职工: 200, 伦敦塔学员: 9999,
  圣所保育员: 8, 圣所职工: 150, 圣所幼崽: 9999,
  公会会长: 1, 公会成员: 50, 冒险者: 9999,
  军队将官: 3, 军队校官: 10, 军队尉官: 30, 军队士兵: 9999,
  西区市长: 1, 西区副市长: 2, 西区技工: 9999,
  东区市长: 1, 东区副市长: 2, 东区贵族: 9999,
  守塔会会长: 1, 守塔会成员: 200,
  恶魔会会长: 1, 恶魔会成员: 9999,
  灵异所所长: 1, 搜捕队队长: 10, 搜捕队队员: 50, 灵异所文员: 20,
  观察者首领: 1, 情报搜集员: 9999, 情报处理员: 9999
};

const LOWEST_JOBS_MAP: Record<string, string> = {
  '圣子/圣女': '仆从', '侍奉者': '仆从', '候选者': '仆从', '仆从': '仆从',
  '军队将官': '军队士兵', '军队校官': '军队士兵', '军队尉官': '军队士兵', '军队士兵': '军队士兵',
  '公会会长': '冒险者', '公会成员': '冒险者', '冒险者': '冒险者',
  '守塔会会长': '守塔会成员', '守塔会成员': '守塔会成员',
  '灵异所所长': '灵异所文员', '搜捕队队长': '灵异所文员', '搜捕队队员': '灵异所文员', '灵异所文员': '灵异所文员',
  '观察者首领': '情报处理员', '情报搜集员': '情报处理员', '情报处理员': '情报处理员',
  '恶魔会会长': '恶魔会成员', '恶魔会成员': '恶魔会成员',
  '东区市长': '东区贵族', '东区副市长': '东区贵族', '东区贵族': '东区贵族',
  '西区市长': '西区技工', '西区副市长': '西区技工', '西区技工': '西区技工',
  '圣所保育员': '圣所职工', '圣所职工': '圣所职工',
};

const getLocalToday = () => {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
};

const deleteUserCascade = db.transaction((userId: number) => {
  db.prepare('DELETE FROM user_inventory WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM user_skills WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM spirit_status WHERE userId = ?').run(userId);
  db.prepare('DELETE FROM rescue_requests WHERE patientId = ? OR healerId = ?').run(userId, userId);
  db.prepare('DELETE FROM roleplay_messages WHERE senderId = ? OR receiverId = ?').run(userId, userId);
  db.prepare('DELETE FROM commissions WHERE publisherId = ? OR acceptedById = ?').run(userId, userId);
  db.prepare('DELETE FROM auction_items WHERE sellerId = ? OR highestBidderId = ?').run(userId, userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use('/api', createRpRouter(db));

  


  // ================= 4. 管理员专属 API =================
  app.post('/api/admin/items', (req, res) => {
    const { name, description, locationTag, npcId, price, faction, tier, itemType, effectValue } = req.body;
    db.prepare(`
      INSERT INTO global_items (name, description, locationTag, npcId, price, faction, tier, itemType, effectValue) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description, locationTag, npcId || null, price, faction || '通用', tier || '低阶', itemType || '回复道具', effectValue || 0);
    res.json({ success: true });
  });

  app.post('/api/admin/skills', (req, res) => {
    const { name, faction, tier, description, npcId } = req.body;
    db.prepare('INSERT INTO global_skills (name, faction, tier, description, npcId) VALUES (?, ?, ?, ?, ?)')
      .run(name, faction, tier || '低阶', description, npcId || null);
    res.json({ success: true });
  });

  // ================= 5. 游戏前端核心 API =================

  app.get('/api/notes/:ownerId/:targetId', (req, res) => {
    const note = db.prepare('SELECT content FROM player_notes WHERE ownerId = ? AND targetId = ?').get(req.params.ownerId, req.params.targetId);
    res.json({ success: true, content: note ? (note as any).content : '' });
  });

  app.post('/api/notes', (req, res) => {
    const { ownerId, targetId, content } = req.body;
    db.prepare(`
      INSERT INTO player_notes (ownerId, targetId, content) VALUES (?, ?, ?)
      ON CONFLICT(ownerId, targetId) DO UPDATE SET content = excluded.content, updatedAt = CURRENT_TIMESTAMP
    `).run(ownerId, targetId, content);
    res.json({ success: true });
  });

  app.post('/api/rp/session/:id/mediate', (req, res) => {
    const { requesterName } = req.body;
    db.prepare("UPDATE active_rp_sessions SET status = 'mediating' WHERE id = ?").run(req.params.id);
    db.prepare('INSERT INTO active_rp_messages (sessionId, senderId, senderName, content, type) VALUES (?, ?, ?, ?, ?)')
      .run(req.params.id, 0, '塔区广播', `[评理请求] ${requesterName} 呼叫了军队阵营介入调停！等待军队玩家加入...`, 'system');
    res.json({ success: true });
  });

  
  app.post('/api/interact/combat', (req, res) => {
    const { attackerId, defenderId, attackerScore, defenderScore } = req.body;
    const isAttackerWin = attackerScore >= defenderScore;
    const loserId = isAttackerWin ? defenderId : attackerId;
    db.prepare('UPDATE users SET hp = maxHp * 0.95 WHERE id = ?').run(loserId);
    res.json({ success: true, isAttackerWin, loserId });
  });

  app.post('/api/interact/prank', (req, res) => {
    const { ghostId, targetId, targetRole } = req.body;
    if (targetRole === '哨兵') {
      db.prepare('UPDATE users SET fury = MIN(100, fury + 15) WHERE id = ?').run(targetId);
      res.json({ success: true, message: '恶作剧成功，对方狂暴值上升！' });
    } else {
      db.prepare('UPDATE users SET mp = MAX(0, mp - (maxMp * 0.05)) WHERE id = ?').run(targetId);
      res.json({ success: true, message: '恶作剧成功，对方精神力受损！' });
    }
  });

  app.post('/api/interact/probe', (req, res) => {
    const { targetId } = req.body;
    const target = db.prepare('SELECT mentalRank, physicalRank, ability, hp, mp, fury FROM users WHERE id = ?').get(targetId) as any;
    const keys = Object.keys(target);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    res.json({ success: true, probedStat: { key: randomKey, value: target[randomKey] } });
  });

  app.post('/api/interact/steal', (req, res) => {
  const { attackerId, thiefId, targetId } = req.body;
  const realAttackerId = attackerId ?? thiefId;
  if (!realAttackerId || !targetId) {
    return res.status(400).json({ success: false, message: '参数缺失(attackerId/thiefId/targetId)' });
  }

  try {
    const targetItems = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND qty > 0').all(targetId) as any[];
    if (targetItems.length === 0) {
      return res.json({ success: false, message: '对方穷得叮当响，什么都没偷到。' });
    }

    const itemToSteal = targetItems[Math.floor(Math.random() * targetItems.length)];

    const transaction = db.transaction(() => {
      if (itemToSteal.qty === 1) {
        db.prepare('DELETE FROM user_inventory WHERE id = ?').run(itemToSteal.id);
      } else {
        db.prepare('UPDATE user_inventory SET qty = qty - 1 WHERE id = ?').run(itemToSteal.id);
      }

      const existingInAttacker = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(realAttackerId, itemToSteal.name) as any;
      if (existingInAttacker) {
        db.prepare('UPDATE user_inventory SET qty = qty + 1 WHERE id = ?').run(existingInAttacker.id);
      } else {
        db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, 1)').run(realAttackerId, itemToSteal.name);
      }
    });

    transaction();
    res.json({ success: true, message: `得手了！你从对方身上顺走了 [${itemToSteal.name}]！` });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});


  app.post('/api/combat/end', (req, res) => {
    const { userId } = req.body;
    db.prepare('UPDATE users SET fury = MIN(100, fury + 20) WHERE id = ?').run(userId);
    res.json({ success: true, message: '战斗结束，精神狂暴值上升了 20%！' });
  });

  app.post('/api/guide/soothe', (req, res) => {
    const { sentinelId, guideId } = req.body;
    const sentinel = db.prepare('SELECT name, fury FROM users WHERE id = ?').get(sentinelId) as any;
    const guide = db.prepare('SELECT name FROM users WHERE id = ?').get(guideId) as any;

    if (!sentinel || !guide) return res.json({ success: false, message: '用户不存在' });

    const str = sentinel.name < guide.name ? sentinel.name + guide.name : guide.name + sentinel.name;
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const compatibility = Math.abs(hash % 101);

    let reduceAmount = 0;
    if (compatibility <= 30) reduceAmount = 10;
    else if (compatibility <= 70) reduceAmount = 30;
    else reduceAmount = 60;

    const newFury = Math.max(0, (sentinel.fury || 0) - reduceAmount);
    db.prepare('UPDATE users SET fury = ? WHERE id = ?').run(newFury, sentinelId);

    res.json({ 
      success: true, 
      compatibility, 
      reduced: reduceAmount,
      currentFury: newFury,
      message: `契合度 ${compatibility}%，狂暴值净化了 ${reduceAmount}%` 
    });
  });

  app.post('/api/explore/skill', (req, res) => {
    const { userId, locationId } = req.body;
    const targetFaction = LOCATION_FACTION_MAP[locationId];
    
    if (!targetFaction) return res.json({ success: false, message: '这里的空气很平静，无法领悟任何派系技能。' });

    const user = db.prepare('SELECT faction FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.json({ success: false, message: '用户不存在' });

    const skills = db.prepare('SELECT * FROM global_skills WHERE faction = ?').all(targetFaction) as any[];
    if (skills.length === 0) return res.json({ success: false, message: `管理员尚未在该区域部署【${targetFaction}】技能库，你什么都没找到。` });

    const randomSkill = skills[Math.floor(Math.random() * skills.length)];

    if (user.faction === targetFaction) {
        db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, 1)').run(userId, randomSkill.name);
        res.json({ success: true, message: `探索大成功！你顿悟了本派系（${targetFaction}）技能：【${randomSkill.name}】(Lv.1)`, type: 'learned' });
    } else {
        const bookName = `[技能书] ${randomSkill.name} (${randomSkill.faction})`;
        const existing = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(userId, bookName) as any;
        if (existing) {
            db.prepare('UPDATE user_inventory SET qty = qty + 1 WHERE id = ?').run(existing.id);
        } else {
            db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, 1)').run(userId, bookName);
        }
        res.json({ success: true, message: `你探索到了一本【${bookName}】！由于派系不符无法直接学习，已放入背包（可交易/出售）。`, type: 'book' });
    }
  });

  app.post('/api/explore/item', (req, res) => {
    const { userId, locationId } = req.body;
    const targetFaction = LOCATION_FACTION_MAP[locationId] || '通用';

    const roll = Math.random() * 100;
    let targetTier = '低阶';
    if (roll > 60 && roll <= 90) targetTier = '中阶';
    else if (roll > 90) targetTier = '高阶';

    let items = db.prepare('SELECT * FROM global_items WHERE faction = ? AND tier = ?').all(targetFaction, targetTier) as any[];
    if (items.length === 0) items = db.prepare('SELECT * FROM global_items WHERE faction = ?').all(targetFaction) as any[];
    if (items.length === 0) items = db.prepare('SELECT * FROM global_items').all() as any[];

    if (items.length === 0) return res.json({ success: false, message: '该区域物资匮乏，什么都没找到。' });

    const randomItem = items[Math.floor(Math.random() * items.length)];

    const existing = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(userId, randomItem.name) as any;
    if (existing) {
      db.prepare('UPDATE user_inventory SET qty = qty + 1 WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, 1)').run(userId, randomItem.name);
    }

    res.json({ success: true, message: `你搜索了一番，发现了 [${randomItem.tier}] ${randomItem.name}！` });
  });

  app.post('/api/inventory/use', (req, res) => {
    const { userId, inventoryId } = req.body;

    try {
      const invItem = db.prepare('SELECT * FROM user_inventory WHERE id = ? AND userId = ?').get(inventoryId, userId) as any;
      if (!invItem || invItem.qty < 1) return res.json({ success: false, message: '物品不存在或数量不足。' });

      const globalItem = db.prepare('SELECT * FROM global_items WHERE name = ?').get(invItem.name) as any;
      let resultMessage = '';

      if (!globalItem) {
        if (invItem.name.startsWith('[技能书]')) {
           return res.json({ success: false, message: '非本派系的技能书，请寻找他人交易，无法直接使用。' });
        }
        return res.json({ success: false, message: '该物品已绝版，无法使用。' });
      }

      if (globalItem.itemType === '回复道具') {
        const heal = globalItem.effectValue || 20;
        db.prepare('UPDATE users SET hp = MIN(maxHp, hp + ?), mp = MIN(maxMp, mp + ?), fury = MAX(0, fury - ?) WHERE id = ?').run(heal, heal, heal, userId);
        resultMessage = `你使用了 ${invItem.name}，状态得到了恢复！(效果: ${heal})`;
      } else if (globalItem.itemType === '技能书道具') {
        const hasSkill = db.prepare('SELECT * FROM user_skills WHERE userId = ? AND name = ?').get(userId, invItem.name) as any;
        if (hasSkill) return res.json({ success: false, message: '你已经学会了这个技能，无需重复领悟。' });
        db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, 1)').run(userId, invItem.name);
        resultMessage = `你研读了 ${invItem.name}，学会了新技能！`;
      } else if (globalItem.itemType === '贵重物品') {
        const goldGained = globalItem.effectValue || globalItem.price || 100;
        db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?').run(goldGained, userId);
        resultMessage = `你将 ${invItem.name} 兑换成了 ${goldGained} 金币！`;
      } else if (globalItem.itemType === '任务道具') {
        return res.json({ success: false, message: '这是任务道具，只能用于提交委托。' });
      }

      if (invItem.qty === 1) db.prepare('DELETE FROM user_inventory WHERE id = ?').run(invItem.id);
      else db.prepare('UPDATE user_inventory SET qty = qty - 1 WHERE id = ?').run(invItem.id);

      res.json({ success: true, message: resultMessage });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete('/api/users/:userId/skills/:skillId', (req, res) => {
    db.prepare('DELETE FROM user_skills WHERE id = ? AND userId = ?').run(req.params.skillId, req.params.userId);
    res.json({ success: true });
  });

  app.post('/api/users/:userId/skills/merge', (req, res) => {
    const { skillName } = req.body;
    const userId = req.params.userId;
    
    const skills = db.prepare('SELECT * FROM user_skills WHERE userId = ? AND name = ? ORDER BY level ASC').all(userId, skillName) as any[];
    
    if (skills.length < 2) return res.json({ success: false, message: '需要至少 2 个同名技能才能进行融合。' });

    let id1 = -1, id2 = -1, targetLevel = -1;
    for (let i = 0; i < skills.length - 1; i++) {
        if (skills[i].level === skills[i+1].level) {
            id1 = skills[i].id;
            id2 = skills[i+1].id;
            targetLevel = skills[i].level + 1;
            break;
        }
    }

    if (id1 === -1) return res.json({ success: false, message: '你需要两个等级完全相同的同名技能才能升阶。' });

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM user_skills WHERE id IN (?, ?)').run(id1, id2);
      db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, ?)').run(userId, skillName, targetLevel);
    });
    transaction();

    res.json({ success: true, message: `融合成功！【${skillName}】 提升到了 Lv.${targetLevel}` });
  });

  app.post('/api/training/complete', (req, res) => {
    const { userId } = req.body;
    const today = getLocalToday();

    try {
      const user = db.prepare('SELECT trainCount, mentalProgress, lastResetDate FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.json({ success: false, message: '用户不存在' });
      if (user.trainCount >= 3 && user.lastResetDate === today) {
        return res.json({ success: false, message: '今日精神力训练次数已耗尽' });
      }

      const newProgress = Math.min(100, (user.mentalProgress || 0) + 5);
      db.prepare(`UPDATE users SET mentalProgress = ?, trainCount = trainCount + 1 WHERE id = ?`).run(newProgress, userId);
      res.json({ success: true, newProgress });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/locations/:locationId/players', (req, res) => {
    const { locationId } = req.params;
    const excludeId = Number(req.query.excludeId);

    try {
      let players: any[] = [];
      if (Number.isFinite(excludeId)) {
        players = db.prepare(`
          SELECT id, name, avatarUrl, role, currentLocation, status
          FROM users WHERE currentLocation = ? AND status IN ('approved', 'ghost') AND id <> ?
          ORDER BY id ASC
        `).all(locationId, excludeId);
      } else {
        players = db.prepare(`
          SELECT id, name, avatarUrl, role, currentLocation, status
          FROM users WHERE currentLocation = ? AND status IN ('approved', 'ghost')
          ORDER BY id ASC
        `).all(locationId);
      }
      res.json({ success: true, players });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/rescue/request', (req, res) => {
    const { patientId, healerId } = req.body;
    db.prepare('INSERT INTO rescue_requests (patientId, healerId) VALUES (?, ?)').run(patientId, healerId);
    res.json({ success: true });
  });

  app.get('/api/rescue/check/:userId', (req, res) => {
    const { userId } = req.params;
    const incoming = db.prepare(
        'SELECT r.*, u.name as patientName FROM rescue_requests r JOIN users u ON r.patientId = u.id WHERE r.healerId = ? AND r.status = "pending"'
      ).get(userId);
    const outgoing = db.prepare('SELECT * FROM rescue_requests WHERE patientId = ? ORDER BY id DESC LIMIT 1').get(userId);
    res.json({ success: true, incoming, outgoing });
  });

  app.post('/api/rescue/accept', (req, res) => {
    const { requestId } = req.body;
    db.prepare('UPDATE rescue_requests SET status = "accepted" WHERE id = ?').run(requestId);
    res.json({ success: true });
  });

  app.post('/api/rescue/reject', (req, res) => {
    const { requestId } = req.body;
    db.prepare('UPDATE rescue_requests SET status = "rejected" WHERE id = ?').run(requestId);
    res.json({ success: true });
  });

  app.post('/api/rescue/confirm', (req, res) => {
    const { patientId } = req.body;
    db.prepare('UPDATE users SET hp = maxHp * 0.3 WHERE id = ?').run(patientId);
    db.prepare('DELETE FROM rescue_requests WHERE patientId = ?').run(patientId);
    res.json({ success: true });
  });

  app.post('/api/users/:id/submit-death', (req, res) => {
    const { type, text } = req.body;
    db.prepare('UPDATE users SET status = ?, deathDescription = ? WHERE id = ?').run(type, text, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/admin/users', (_req, res) => {
    try {
      const users = db.prepare('SELECT * FROM users ORDER BY id DESC').all();
      res.json({ success: true, users });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/users/:id/status', (req, res) => {
    const { status } = req.body;
    const userId = req.params.id;
    
    if (status === 'dead') {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (user) {
        const exist = db.prepare('SELECT id FROM tombstones WHERE name = ?').get(user.name);
        if (!exist) {
          db.prepare(`
            INSERT INTO tombstones (name, deathDescription, role, mentalRank, physicalRank, ability, spiritName) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(user.name, user.deathDescription || '无名之殇', user.role, user.mentalRank, user.physicalRank, user.ability, user.spiritName);
        }
      }
    }
    
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
    res.json({ success: true });
  });

  app.delete('/api/admin/users/:id', (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: '无效用户ID' });

    try {
      deleteUserCascade(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.delete('/api/users/:id', (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: '无效用户ID' });

    try {
      deleteUserCascade(userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.put('/api/admin/users/:id', (req, res) => {
    let { role, age, faction, mentalRank, physicalRank, ability, spiritName, profileText, status, password } = req.body;
    
    if (age && age < 16) {
      faction = '圣所';
      role = '未分化';
    }

    db.prepare(
      `UPDATE users
       SET role=?, age=?, faction=?, mentalRank=?, physicalRank=?, ability=?, spiritName=?, profileText=?, status=?, password=?
       WHERE id=?`
    ).run(
      role, age, faction, mentalRank, physicalRank, ability,
      spiritName, profileText, status || 'approved', password || null, req.params.id
    );

    res.json({ success: true });
  });

  app.put('/api/users/:id/settings', (req, res) => {
    const { roomBgImage, roomDescription, allowVisit, password } = req.body;
    db.prepare(`
       UPDATE users SET roomBgImage=?, roomDescription=?, allowVisit=?, password=? WHERE id=?
    `).run(
      roomBgImage || null, roomDescription || null, allowVisit ? 1 : 0, password || null, req.params.id
    );
    res.json({ success: true });
  });

  app.get('/api/admin/roleplay_logs', (_req, res) => {
    const logs = db.prepare('SELECT * FROM roleplay_messages ORDER BY locationId ASC, createdAt DESC').all();
    res.json({ success: true, logs });
  });

  app.get('/api/items', (_req, res) => {
    res.json({ success: true, items: db.prepare('SELECT * FROM global_items').all() });
  });

  app.delete('/api/admin/items/:id', (req, res) => {
    db.prepare('DELETE FROM global_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/skills', (_req, res) => {
    res.json({ success: true, skills: db.prepare('SELECT * FROM global_skills').all() });
  });

  app.delete('/api/admin/skills/:id', (req, res) => {
    db.prepare('DELETE FROM global_skills WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // 读取所有用户数据的路由，尽量靠前放置避免覆盖
  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name) as any;
    if (!user) return res.json({ success: false, message: 'User not found' });

    const today = getLocalToday();
    if (user.lastResetDate !== today) {
      db.prepare('UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ? WHERE id = ?').run(today, user.id);
      user.workCount = 0;
      user.trainCount = 0;
    }

    res.json({ success: true, user });
  });

  app.post('/api/users/init', (req, res) => {
    try {
      db.prepare(`INSERT INTO users (name, status) VALUES (?, 'pending')`).run(req.body.name);
      res.json({ success: true });
    } catch {
      res.json({ success: false, message: '初始化失败' });
    }
  });

  app.post('/api/users', (req, res) => {
    let { name, role, age, mentalRank, physicalRank, gold, ability, spiritName, spiritType } = req.body;
    
    if (age && age < 16) {
      role = '未分化';
    }

    try {
      db.prepare(`
        UPDATE users
        SET role=?, age=?, mentalRank=?, physicalRank=?, gold=?, ability=?, spiritName=?, spiritType=?, status='pending'
        WHERE name=?
      `).run(role, age || 18, mentalRank, physicalRank, gold, ability, spiritName, spiritType, name);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/users/:id/location', (req, res) => {
    db.prepare('UPDATE users SET currentLocation = ? WHERE id = ?').run(req.body.locationId, req.params.id);
    res.json({ success: true });
  });

  app.put('/api/users/:id/avatar', (req, res) => {
    db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(req.body.avatarUrl, req.params.id);
    res.json({ success: true });
  });

  app.get('/api/users/:id/inventory', (req, res) => {
    const items = db.prepare(`
      SELECT ui.*, gi.itemType, gi.effectValue, gi.description, gi.tier 
      FROM user_inventory ui 
      LEFT JOIN global_items gi ON ui.name = gi.name 
      WHERE ui.userId = ?
    `).all(req.params.id);
    res.json({ success: true, items });
  });

  app.post('/api/users/:id/inventory/add', (req, res) => {
    const { name, qty } = req.body;
    const userId = req.params.id;
    const existing = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(userId, name) as any;

    if (existing) {
      db.prepare('UPDATE user_inventory SET qty = qty + ? WHERE id = ?').run(qty || 1, existing.id);
    } else {
      db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, ?)').run(userId, name, qty || 1);
    }
    res.json({ success: true });
  });

  app.get('/api/market/goods', (_req, res) => {
    const goods = db.prepare('SELECT * FROM global_items WHERE price > 0').all();
    res.json({ success: true, goods });
  });

  app.post('/api/market/buy', (req, res) => {
    const { userId, itemId } = req.body;
    try {
      const item = db.prepare('SELECT * FROM global_items WHERE id = ?').get(itemId) as any;
      const user = db.prepare('SELECT gold FROM users WHERE id = ?').get(userId) as any;

      if (!item || !user) return res.json({ success: false, message: '数据异常' });
      if (user.gold < item.price) return res.json({ success: false, message: '金币不足' });

      db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(item.price, userId);

      const existing = db.prepare('SELECT * FROM user_inventory WHERE userId = ? AND name = ?').get(userId, item.name) as any;
      if (existing) {
        db.prepare('UPDATE user_inventory SET qty = qty + 1 WHERE id = ?').run(existing.id);
      } else {
        db.prepare('INSERT INTO user_inventory (userId, name, qty) VALUES (?, ?, 1)').run(userId, item.name);
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/auction/items', (_req, res) => {
    const items = db.prepare("SELECT * FROM auction_items WHERE status = 'active'").all();
    res.json({ success: true, items });
  });

  app.post('/api/auction/consign', (req, res) => {
    const { userId, itemId, minPrice } = req.body;
    try {
      const invItem = db.prepare('SELECT * FROM user_inventory WHERE id = ? AND userId = ?').get(itemId, userId) as any;
      if (!invItem || invItem.qty < 1) return res.json({ success: false, message: '背包中没有该物品' });

      if (invItem.qty === 1) db.prepare('DELETE FROM user_inventory WHERE id = ?').run(itemId);
      else db.prepare('UPDATE user_inventory SET qty = qty - 1 WHERE id = ?').run(itemId);

      const auctionId = `AUC-${Date.now()}`;
      db.prepare('INSERT INTO auction_items (id, itemId, name, sellerId, currentPrice, minPrice) VALUES (?, ?, ?, ?, ?, ?)')
        .run(auctionId, itemId, invItem.name, userId, minPrice, minPrice);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/auction/bid', (req, res) => {
    const { userId, itemId, price } = req.body;
    try {
      const auction = db.prepare("SELECT * FROM auction_items WHERE id = ? AND status = 'active'").get(itemId) as any;
      if (!auction) return res.json({ success: false, message: '拍卖已结束或不存在' });
      if (price <= auction.currentPrice) return res.json({ success: false, message: '出价必须高于当前价格' });

      const user = db.prepare('SELECT gold FROM users WHERE id = ?').get(userId) as any;
      if (user.gold < price) return res.json({ success: false, message: '金币不足' });

      if (auction.highestBidderId) {
        db.prepare('UPDATE users SET gold = gold + ? WHERE id = ?').run(auction.currentPrice, auction.highestBidderId);
      }

      db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(price, userId);
      db.prepare('UPDATE auction_items SET currentPrice = ?, highestBidderId = ? WHERE id = ?').run(price, userId, itemId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/skills/available/:userId', (req, res) => {
    const user = db.prepare('SELECT faction, age FROM users WHERE id = ?').get(req.params.userId) as any;
    if (!user) return res.status(404).json({ success: false });

    const faction = user.age < 16 ? '圣所' : user.faction;
    const skills = db.prepare('SELECT * FROM global_skills WHERE faction = ?').all(faction);
    res.json({ success: true, skills });
  });

  app.get('/api/users/:id/skills', (req, res) => {
    const skills = db.prepare('SELECT * FROM user_skills WHERE userId = ?').all(req.params.id);
    res.json({ success: true, skills });
  });

  app.post('/api/users/:id/skills', (req, res) => {
    db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, 1)').run(req.params.id, req.body.name);
    res.json({ success: true });
  });

  app.get('/api/users/:id/spirit-status', (req, res) => {
    let status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(req.params.id) as any;
    if (!status) {
      db.prepare('INSERT INTO spirit_status (userId) VALUES (?)').run(req.params.id);
      status = { userId: Number(req.params.id), intimacy: 0, level: 1, hp: 100, status: '良好', name: '', imageUrl: '' };
    }
    res.json({ success: true, spiritStatus: status });
  });

  app.post('/api/tower/interact-spirit', (req, res) => {
    const { userId, intimacyGain, imageUrl, name } = req.body;

    let status = db.prepare('SELECT * FROM spirit_status WHERE userId = ?').get(userId) as any;
    if (!status) {
      db.prepare('INSERT INTO spirit_status (userId) VALUES (?)').run(userId);
      status = { intimacy: 0, level: 1 };
    }

    const user = db.prepare('SELECT mentalProgress FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });

    if (imageUrl) db.prepare('UPDATE spirit_status SET imageUrl = ? WHERE userId = ?').run(imageUrl, userId);
    if (name) db.prepare('UPDATE spirit_status SET name = ? WHERE userId = ?').run(name, userId);

    const newIntimacy = (status.intimacy || 0) + (intimacyGain || 0);
    const levelGain = Math.floor(newIntimacy / 100);
    const finalIntimacy = newIntimacy % 100;
    const newMentalProgress = Math.min(100, (user.mentalProgress || 0) + levelGain * 20);

    db.prepare('UPDATE spirit_status SET intimacy = ?, level = level + ? WHERE userId = ?').run(finalIntimacy, levelGain, userId);
    db.prepare('UPDATE users SET mentalProgress = ? WHERE id = ?').run(newMentalProgress, userId);

    res.json({ success: true, levelUp: levelGain > 0 });
  });

  app.post('/api/tower/join', (req, res) => {
    const { userId, jobName } = req.body;
    try {
      const user = db.prepare('SELECT job, age FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.json({ success: false, message: '用户不存在' });
      if (user.job && user.job !== '无') return res.json({ success: false, message: '已有职位' });

      if (user.age < 16 && jobName !== '圣所幼崽') {
         return res.json({ success: false, message: '未分化者无法执行该操作' });
      }

      let finalJob = jobName;
      if (user.age >= 16 && user.age <= 19) {
        if (finalJob === '伦敦塔教师' || finalJob === '伦敦塔职工') {
          finalJob = '伦敦塔学员';
        } else if (LOWEST_JOBS_MAP[finalJob]) {
          finalJob = LOWEST_JOBS_MAP[finalJob];
        }
      }

      const currentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE job = ?').get(finalJob) as any;
      if (currentCount.count >= (JOB_LIMITS[finalJob] || 0)) {
        return res.json({ success: false, message: '该职位名额满。' });
      }

      db.prepare('UPDATE users SET job = ? WHERE id = ?').run(finalJob, userId);
      res.json({ success: true, job: finalJob });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/tower/checkin', (req, res) => {
    const { userId } = req.body;
    const today = getLocalToday();

    const user = db.prepare('SELECT job, lastCheckInDate FROM users WHERE id = ?').get(userId) as any;
    if (!user || !user.job || user.job === '无') return res.json({ success: false, message: '无法签到' });
    if (user.lastCheckInDate === today) return res.json({ success: false, message: '今日已领取过工资' });

    const salary = JOB_SALARIES[user.job] || 0;
    db.prepare('UPDATE users SET gold = gold + ?, lastCheckInDate = ? WHERE id = ?').run(salary, today, userId);

    res.json({ success: true, reward: salary });
  });

  app.post('/api/tower/work', (req, res) => {
    const { userId } = req.body;
    try {
      const user = db.prepare('SELECT job, workCount FROM users WHERE id = ?').get(userId) as any;
      if (!user || !user.job || user.job === '无') return res.json({ success: false, message: '你目前没有职位，无法打工' });
      if (user.workCount >= 3) return res.json({ success: false, message: '今日打工次数已达上限' });

      const baseSalary = JOB_SALARIES[user.job] || 500;
      const reward = Math.floor(baseSalary * 0.1);

      db.prepare('UPDATE users SET gold = gold + ?, workCount = workCount + 1 WHERE id = ?').run(reward, userId);
      res.json({ success: true, reward });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/tower/quit', (req, res) => {
    const { userId } = req.body;
    try {
      const user = db.prepare('SELECT job, gold FROM users WHERE id = ?').get(userId) as any;
      if (!user || !user.job || user.job === '无') return res.json({ success: false, message: '你没有入职，无法离职' });

      const penalty = Math.floor((JOB_SALARIES[user.job] || 0) * 0.3);
      if (user.gold < penalty) return res.json({ success: false, message: `金币不足以支付违约金 (${penalty}G)` });

      db.prepare('UPDATE users SET job = "无", gold = gold - ? WHERE id = ?').run(penalty, userId);
      res.json({ success: true, penalty });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/tower/rest', (req, res) => {
    const { userId } = req.body;
    try {
      db.prepare('UPDATE users SET hp = maxHp, mp = maxMp WHERE id = ?').run(userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/roleplay', (req, res) => {
    const { senderId, senderName, receiverId, receiverName, content, locationId } = req.body;
    db.prepare(
      'INSERT INTO roleplay_messages (senderId, senderName, receiverId, receiverName, content, locationId) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(senderId, senderName, receiverId, receiverName, content, locationId);
    res.json({ success: true });
  });

  app.get('/api/roleplay/conversation/:userId/:otherId', (req, res) => {
    const { userId, otherId } = req.params;
    const messages = db
      .prepare(
        'SELECT * FROM roleplay_messages WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?) ORDER BY createdAt ASC'
      )
      .all(userId, otherId, otherId, userId);

    db.prepare('UPDATE roleplay_messages SET isRead = 1 WHERE receiverId = ? AND senderId = ?').run(userId, otherId);
    res.json({ success: true, messages });
  });

  app.get('/api/roleplay/unread/:userId', (req, res) => {
    const result = db
      .prepare('SELECT COUNT(*) as count FROM roleplay_messages WHERE receiverId = ? AND isRead = 0')
      .get(req.params.userId) as any;
    res.json({ success: true, count: result.count || 0 });
  });

  app.get('/api/commissions', (_req, res) => {
    const commissions = db.prepare('SELECT * FROM commissions ORDER BY createdAt DESC').all();
    res.json({ success: true, commissions });
  });

  app.post('/api/commissions', (req, res) => {
    const { id, publisherId, publisherName, title, content, difficulty, reward, isAnonymous } = req.body;
    db.prepare('UPDATE users SET gold = gold - ? WHERE id = ?').run(reward || 0, publisherId);
    db.prepare(
      'INSERT INTO commissions (id, publisherId, publisherName, title, content, difficulty, reward, isAnonymous) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, publisherId, publisherName, title, content, difficulty || 'C', reward || 0, isAnonymous ? 1 : 0);
    res.json({ success: true });
  });

  app.put('/api/commissions/:id/accept', (req, res) => {
    db.prepare('UPDATE commissions SET status = "accepted", acceptedById = ?, acceptedByName = ? WHERE id = ?')
      .run(req.body.userId, req.body.userName, req.params.id);
    res.json({ success: true });
  });
  
  app.put('/api/commissions/:id/release', (req, res) => {
    db.prepare('UPDATE commissions SET status = "open", acceptedById = NULL, acceptedByName = NULL WHERE id = ?')
      .run(req.params.id);
    res.json({ success: true });
  });

  app.post('/api/commissions/:id/resolve-dispute', (req, res) => {
    const { userId } = req.body;
    const commissionId = req.params.id;

    db.prepare('UPDATE users SET gold = gold + 1000 WHERE id = ?').run(userId);
    db.prepare('DELETE FROM commissions WHERE id = ?').run(commissionId);

    res.json({ success: true });
  });

  app.get('/api/graveyard', (_req, res) => {
    const tombstones = db.prepare('SELECT * FROM tombstones ORDER BY id DESC').all();
    res.json({ success: true, tombstones });
  });

  app.get('/api/graveyard/:id/comments', (req, res) => {
    const comments = db.prepare('SELECT * FROM tombstone_comments WHERE tombstoneId = ? ORDER BY createdAt ASC').all(req.params.id);
    res.json({ success: true, comments });
  });

  app.post('/api/graveyard/:id/comments', (req, res) => {
    const { userId, userName, content } = req.body;
    db.prepare('INSERT INTO tombstone_comments (tombstoneId, userId, userName, content) VALUES (?, ?, ?, ?)')
      .run(req.params.id, userId, userName, content);
    res.json({ success: true });
  });

  app.delete('/api/graveyard/comments/:commentId', (req, res) => {
    const { userId } = req.body;
    db.prepare('DELETE FROM tombstone_comments WHERE id = ? AND userId = ?').run(req.params.commentId, userId);
    res.json({ success: true });
  });

  app.get('/api/users/:id/rp_archives', (req, res) => {
    const userId = req.params.id;
    const archives = db.prepare(`SELECT * FROM rp_archives WHERE participants LIKE ? ORDER BY createdAt DESC`).all(`%${userId}%`) as any[];
    for (let arc of archives) {
      arc.messages = db.prepare('SELECT * FROM rp_archive_messages WHERE archiveId = ? ORDER BY createdAt ASC').all(arc.id);
    }
    res.json({ success: true, archives });
  });


  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        // 【修复2】读取真正的 index.html 模板内容而不是硬编码，以支持外部样式表
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) return res.status(404).send('API not found');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// 【修复3】捕捉并处理异步入口错误，避免隐式崩溃
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
