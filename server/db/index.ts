import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runSchema } from './schema';
import { runMigrate } from './migrate';
import { runSeed } from './seed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initDb() {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'game.db');
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  runSchema(db);
  runMigrate(db);
  runSeed(db);

  return db;
}
