import Database from 'better-sqlite3';

export function runSeed(db: Database.Database) {
  db.prepare(`
    INSERT OR IGNORE INTO admin_whitelist (name, code_name, enabled)
    VALUES ('塔', 'tower_admin', 1)
  `).run();
}
