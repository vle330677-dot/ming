import Database from 'better-sqlite3';

export function runSchema(db: Database.Database) {
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
      avatarUpdatedAt TEXT,
      status TEXT DEFAULT 'pending',
      deathDescription TEXT,
      profileText TEXT,
      isHidden INTEGER DEFAULT 0,
      currentLocation TEXT,
      homeLocation TEXT,
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
      loginPasswordHash TEXT,
      roomPasswordHash TEXT,
      roomBgImage TEXT,
      roomDescription TEXT,
      allowVisit INTEGER DEFAULT 1,
      fury INTEGER DEFAULT 0,
      partyId TEXT DEFAULT NULL,
      adminAvatarUrl TEXT,
      forceOfflineAt TEXT
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'system',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      extraJson TEXT,
      payload TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      userName TEXT NOT NULL,
      role TEXT DEFAULT 'player',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastSeenAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      revokedAt DATETIME
    );

    CREATE TABLE IF NOT EXISTS admin_whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      code_name TEXT,
      enabled INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adminName TEXT NOT NULL,
      action TEXT NOT NULL,
      targetType TEXT,
      targetId TEXT,
      detail TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_migrations (
      key TEXT PRIMARY KEY,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
