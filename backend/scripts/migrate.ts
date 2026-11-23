/**
 * Chạy các file SQL trong db/migration theo thứ tự tên (001_, 002_, ...).
 * File nào đã chạy thì ghi vào bảng schema_migrations và không chạy lại.
 *
 *   npm run migrate
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const MIGRATION_DIR = path.resolve(__dirname, '../db/migration');
const FILE_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;
const LOCK_ID = 20261122; // khóa để 2 người chạy migrate cùng lúc không đụng nhau

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Thiếu DATABASE_URL trong file .env');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ filename: string }>('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    const files = readdirSync(MIGRATION_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const badNames = files.filter((f) => !FILE_PATTERN.test(f));
    if (badNames.length > 0) {
      throw new Error(`Tên file migration sai quy ước NNN_ten_file.sql: ${badNames.join(', ')}`);
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('Không có migration mới. Database đã ở phiên bản mới nhất.');
      return;
    }

    for (const file of pending) {
      const sql = readFileSync(path.join(MIGRATION_DIR, file), 'utf8');
      if (sql.trim() === '') {
        throw new Error(`File ${file} đang rỗng. Viết SQL vào trước khi chạy migrate.`);
      }

      // Mỗi file 1 transaction: lỗi giữa chừng thì file đó không để lại gì trong DB
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✔ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ✘ ${file}`);
        throw err;
      }
    }

    console.log(`Đã chạy ${pending.length} migration.`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => undefined);
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error('Migrate thất bại:', err instanceof Error ? err.message : err);
  process.exit(1);
});
