import Database from 'better-sqlite3';


const addColumn = (db: Database.Database, table: string, col: string, type: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(table) || !/^[a-zA-Z0-9_]+$/.test(col)) return;
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  } catch {
    // ignore duplicate
  }
};

export function runMigrate(db: Database.Database) {
  addColumn(db, 'users', 'homeLocation', 'TEXT');
  addColumn(db, 'users', 'avatarUpdatedAt', 'TEXT');
  addColumn(db, 'users', 'allowVisit', 'INTEGER DEFAULT 1');
  addColumn(db, 'users', 'roomPasswordHash', 'TEXT');
  addColumn(db, 'announcements', 'payload', 'TEXT');
  addColumn(db, 'announcements', 'created_at', 'DATETIME');
  addColumn(db, 'users', 'roomVisible', 'INTEGER DEFAULT 1');


  const hasFix = db.prepare(`SELECT 1 FROM system_migrations WHERE key = ?`).get('fix_minor_home_v1');
  if (!hasFix) {
    db.exec(`
      UPDATE users
      SET homeLocation = 'sanctuary'
      WHERE age < 16
        AND (homeLocation IS NULL OR homeLocation <> 'sanctuary');
    `);
    db.prepare(`INSERT INTO system_migrations(key) VALUES (?)`).run('fix_minor_home_v1');
  }
}
