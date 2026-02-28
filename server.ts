import express from 'express';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || 'game.db';
const db = new Database(dbPath);

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
    price INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS global_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    faction TEXT, 
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
  CREATE TABLE IF NOT EXISTS tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    deathDescription TEXT, -- 这里的文本将作为 墓志铭/谢幕戏
    role TEXT,
    mentalRank TEXT,
    physicalRank TEXT,
    ability TEXT,
    spiritName TEXT,
    isHidden INTEGER DEFAULT 0
  );

  -- 新增：墓碑留言表
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

// 动态补全可能缺失的字段 (兼容老数据库)
const addColumn = (table: string, col: string, type: string) => {
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
addColumn('roleplay_messages', 'locationId', 'TEXT');
addColumn('global_items', 'npcId', 'TEXT');
addColumn('global_skills', 'npcId', 'TEXT');

// ================= 2. 初始数据种子 =================
const seedData = () => {
  const initialSkills = [
    { name: '精神梳理', faction: '向导', description: '安抚哨兵狂躁的精神图景。' },
    { name: '五感强化', faction: '哨兵', description: '短时间内极大提升战场感知力。' },
    { name: '圣所祷告', faction: '圣所', description: '未分化幼崽的必修课，平复情绪。' }
  ];

  const skillCount = db.prepare('SELECT COUNT(*) as count FROM global_skills').get() as any;
  if (skillCount.count === 0) {
    const insertSkill = db.prepare('INSERT INTO global_skills (name, faction, description) VALUES (?, ?, ?)');
    initialSkills.forEach((s) => insertSkill.run(s.name, s.faction, s.description));
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

// 16-19岁强制降级映射表
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

// 本地日期（避免 UTC 偏差）
const getLocalToday = () => {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
};

// 级联删除
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

  // ================= 4. 管理员专属 API =================
  app.post('/api/admin/items', (req, res) => {
    const { name, description, locationTag, npcId, price } = req.body;
    db.prepare('INSERT INTO global_items (name, description, locationTag, npcId, price) VALUES (?, ?, ?, ?, ?)')
      .run(name, description, locationTag, npcId || null, price);
    res.json({ success: true });
  });

  app.post('/api/admin/skills', (req, res) => {
    const { name, faction, description, npcId } = req.body;
    db.prepare('INSERT INTO global_skills (name, faction, description, npcId) VALUES (?, ?, ?, ?)')
      .run(name, faction, description, npcId || null);
    res.json({ success: true });
  });

  // ================= 5. 游戏前端核心 API =================

  // --- 狂暴值系统：战斗增加 ---
  app.post('/api/combat/end', (req, res) => {
    const { userId } = req.body;
    // 简单的战斗逻辑：只要战斗，狂暴值+20 (上限100)
    db.prepare('UPDATE users SET fury = MIN(100, fury + 20) WHERE id = ?').run(userId);
    res.json({ success: true, message: '战斗结束，精神狂暴值上升了 20%！' });
  });

  // --- 狂暴值系统：向导抚慰 ---
  app.post('/api/guide/soothe', (req, res) => {
    const { sentinelId, guideId } = req.body;
    
    const sentinel = db.prepare('SELECT name, fury FROM users WHERE id = ?').get(sentinelId) as any;
    const guide = db.prepare('SELECT name FROM users WHERE id = ?').get(guideId) as any;

    if (!sentinel || !guide) return res.json({ success: false, message: '用户不存在' });

    // 1. 计算契合度 (复用前端算法保证一致)
    const str = sentinel.name < guide.name ? sentinel.name + guide.name : guide.name + sentinel.name;
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const compatibility = Math.abs(hash % 101);

    // 2. 判定减少数值
    let reduceAmount = 0;
    if (compatibility <= 30) reduceAmount = 10;
    else if (compatibility <= 70) reduceAmount = 30;
    else reduceAmount = 60;

    // 3. 执行更新
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

  // --- 技能管理：删除技能 ---
  app.delete('/api/users/:userId/skills/:skillId', (req, res) => {
    db.prepare('DELETE FROM user_skills WHERE id = ? AND userId = ?').run(req.params.skillId, req.params.userId);
    res.json({ success: true });
  });

  // --- 技能管理：技能合并/升阶 ---
  app.post('/api/users/:userId/skills/merge', (req, res) => {
    const { skillName } = req.body;
    const userId = req.params.userId;
    
    // 检查是否有至少2个同名技能用于合并
    const skills = db.prepare('SELECT * FROM user_skills WHERE userId = ? AND name = ?').all(userId, skillName) as any[];
    
    if (skills.length < 2) {
      return res.json({ success: false, message: '需要至少2个同名技能才能进行融合升阶。' });
    }

    // 简单的合并逻辑：删除前两个，生成一个新的高级版（或者等级+1）
    const id1 = skills[0].id;
    const id2 = skills[1].id;
    const newLevel = (skills[0].level || 1) + 1;

    const deleteStmt = db.prepare('DELETE FROM user_skills WHERE id IN (?, ?)');
    const insertStmt = db.prepare('INSERT INTO user_skills (userId, name, level) VALUES (?, ?, ?)');

    const transaction = db.transaction(() => {
      deleteStmt.run(id1, id2);
      insertStmt.run(userId, skillName, newLevel);
    });
    transaction();

    res.json({ success: true, message: `融合成功！${skillName} 提升到了 Lv.${newLevel}` });
  });

  // --- 精神力训练系统 ---
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

      db.prepare(`
        UPDATE users 
        SET mentalProgress = ?, trainCount = trainCount + 1 
        WHERE id = ?
      `).run(newProgress, userId);

      res.json({ success: true, newProgress });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // --- 同地点玩家列表（用于点击头像发起对戏）---
  app.get('/api/locations/:locationId/players', (req, res) => {
    const { locationId } = req.params;
    const excludeId = Number(req.query.excludeId);

    try {
      let players: any[] = [];

      if (Number.isFinite(excludeId)) {
        players = db.prepare(`
          SELECT id, name, avatarUrl, role, currentLocation, status
          FROM users
          WHERE currentLocation = ?
            AND status IN ('approved', 'ghost')
            AND id <> ?
          ORDER BY id ASC
        `).all(locationId, excludeId);
      } else {
        players = db.prepare(`
          SELECT id, name, avatarUrl, role, currentLocation, status
          FROM users
          WHERE currentLocation = ?
            AND status IN ('approved', 'ghost')
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
    const incoming = db
      .prepare(
        'SELECT r.*, u.name as patientName FROM rescue_requests r JOIN users u ON r.patientId = u.id WHERE r.healerId = ? AND r.status = "pending"'
      )
      .get(userId);
    const outgoing = db.prepare('SELECT * FROM rescue_requests WHERE patientId = ? ORDER BY id DESC LIMIT 1').get(userId);
    res.json({ success: true, incoming, outgoing });
  });

  app.post('/api/rescue/accept', (req, res) => {
    const { requestId } = req.body;
    db.prepare('UPDATE rescue_requests SET status = "accepted" WHERE id = ?').run(requestId);
    res.json({ success: true });
  });

  app.post('/api/rescue/confirm', (req, res) => {
    const { patientId } = req.body;
    db.prepare('UPDATE users SET hp = 20 WHERE id = ?').run(patientId);
    db.prepare('DELETE FROM rescue_requests WHERE patientId = ?').run(patientId);
    res.json({ success: true });
  });
  // 拒绝救援
  app.post('/api/rescue/reject', (req, res) => {
    const { requestId } = req.body;
    db.prepare('UPDATE rescue_requests SET status = "rejected" WHERE id = ?').run(requestId);
    res.json({ success: true });
  });

  // 确认救援，恢复 30% HP
  app.post('/api/rescue/confirm', (req, res) => {
    const { patientId } = req.body;
    // 恢复 30% 最大生命值
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
      const users = db.prepare('SELECT * FROM users').all();
      const processedUsers = users.map((u: any) => ({
        ...u,
        faction: u.age < 16 ? '圣所' : u.faction,
        role: u.age < 16 ? '未分化' : u.role
      }));
      res.json({ success: true, users: processedUsers });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post('/api/admin/users/:id/status', (req, res) => {
    const { status } = req.body;
    const userId = req.params.id;
    
    // 如果管理员批准死亡，生成墓碑
    if (status === 'dead') {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (user) {
        // 检查是否已经有墓碑防止重复生成
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
    const { role, age, faction, mentalRank, physicalRank, ability, spiritName, profileText, status, password } = req.body;
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
       UPDATE users 
       SET roomBgImage=?, roomDescription=?, allowVisit=?, password=? 
       WHERE id=?
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

  app.get('/api/users/:name', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.params.name) as any;
    if (!user) return res.json({ success: false, message: 'User not found' });

    const today = getLocalToday();
    if (user.lastResetDate !== today) {
      db.prepare('UPDATE users SET workCount = 0, trainCount = 0, lastResetDate = ? WHERE id = ?').run(today, user.id);
      user.workCount = 0;
      user.trainCount = 0;
    }
    if (user.age < 16) {
      user.faction = '圣所';
      user.role = '未分化';
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

  // 更新用户信息（抽取后保存）
  app.post('/api/users', (req, res) => {
    const { name, role, age, mentalRank, physicalRank, gold, ability, spiritName, spiritType } = req.body;
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
    const items = db.prepare('SELECT * FROM user_inventory WHERE userId = ?').all(req.params.id);
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

  // --- 入职与系统判定 ---
  app.post('/api/tower/join', (req, res) => {
    const { userId, jobName } = req.body;
    try {
      const user = db.prepare('SELECT job, age FROM users WHERE id = ?').get(userId) as any;
      if (!user) return res.json({ success: false, message: '用户不存在' });
      if (user.job && user.job !== '无') return res.json({ success: false, message: '已有职位' });

      // 未成年拦截
      if (user.age < 16 && jobName !== '圣所幼崽') {
         return res.json({ success: false, message: '未分化者无法执行该操作' });
      }

      let finalJob = jobName;
      // 16-19岁强制降级逻辑 (除了学员外，统一打回基层)
      if (user.age >= 16 && user.age <= 19) {
        if (finalJob === '伦敦塔教师' || finalJob === '伦敦塔职工') {
          finalJob = '伦敦塔学员';
        } else if (LOWEST_JOBS_MAP[finalJob]) {
          finalJob = LOWEST_JOBS_MAP[finalJob];
        }
      }

      const currentCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE job = ?').get(finalJob) as any;
      if (currentCount.count >= (JOB_LIMITS[finalJob] || 0)) {
        return res.json({ success: false, message: '该职位名额已满。' });
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

  // ================= 6. 前端路由 =================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        let template =
          '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>';
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
  // --- 公墓与留言系统 ---
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
    const { userId } = req.body; // 校验是不是本人删的
    db.prepare('DELETE FROM tombstone_comments WHERE id = ? AND userId = ?').run(req.params.commentId, userId);
    res.json({ success: true });
  });
}

startServer();