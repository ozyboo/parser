import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";

/**
 * Подключение к базе, два режима:
 *
 * 1. Задан DATABASE_URL — настоящий PostgreSQL (как раньше).
 * 2. DATABASE_URL нет — встроенный PostgreSQL (PGlite, WASM),
 *    данные лежат в ./data/pg. Приложение работает из коробки:
 *    `npm install && npm run dev` — без Docker и настройки базы.
 *
 * Таблицы в обоих режимах создаются автоматически (ensureSchema),
 * отдельный `drizzle-kit push` больше не нужен.
 */

const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

export const dbKind: "postgres" | "embedded" = databaseUrl ? "postgres" : "embedded";

type GlobalForDb = typeof globalThis & {
  __parserPgPool?: Pool;
  __parserPglite?: PGlite;
  __parserDb?: NodePgDatabase;
  __parserSchemaReady?: Promise<void>;
};

const globalForDb = globalThis as GlobalForDb;

function createDb(): NodePgDatabase {
  if (databaseUrl) {
    const pool = globalForDb.__parserPgPool ?? new Pool({ connectionString: databaseUrl });
    globalForDb.__parserPgPool = pool;
    return drizzleNodePg(pool);
  }

  // Во время `next build` модуль импортируется воркерами, но запросов нет —
  // используем in-memory базу, чтобы не трогать диск и не ловить локи каталога.
  const dataDir = isBuildPhase
    ? undefined
    : (process.env.PGLITE_DATA_DIR?.trim() || path.join(process.cwd(), "data", "pg"));

  // PGlite делает обычный (нерекурсивный) mkdir — каталог создаём сами.
  if (dataDir) mkdirSync(dataDir, { recursive: true });

  const client = globalForDb.__parserPglite ?? new PGlite(dataDir);
  globalForDb.__parserPglite = client;

  // PgliteDatabase и NodePgDatabase — один и тот же pg query builder,
  // разница только в типе сырого результата execute(). Приводим к одному типу.
  return drizzlePglite(client) as unknown as NodePgDatabase;
}

export const db: NodePgDatabase = globalForDb.__parserDb ?? createDb();
globalForDb.__parserDb = db;

/** DDL, зеркалящий src/db/schema.ts. Все операторы — IF NOT EXISTS, идемпотентно. */
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sources (
    id serial PRIMARY KEY,
    kind text NOT NULL,
    handle text NOT NULL,
    title text NOT NULL DEFAULT '',
    enabled boolean NOT NULL DEFAULT true,
    last_fetched_at timestamptz,
    last_error text,
    last_new_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id serial PRIMARY KEY,
    source_id integer NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    source_kind text NOT NULL,
    source_title text NOT NULL DEFAULT '',
    external_id text NOT NULL,
    title text NOT NULL DEFAULT '',
    text text NOT NULL DEFAULT '',
    html text NOT NULL DEFAULT '',
    url text NOT NULL DEFAULT '',
    author text NOT NULL DEFAULT '',
    image_url text,
    published_at timestamptz,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    is_read boolean NOT NULL DEFAULT false,
    is_starred boolean NOT NULL DEFAULT false,
    meta jsonb
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sources_kind_handle_idx ON sources (kind, handle)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS posts_source_external_idx ON posts (source_id, external_id)`,
  `CREATE INDEX IF NOT EXISTS posts_published_idx ON posts (published_at)`,
];

/**
 * Создаёт таблицы, если их ещё нет. Запросы к PGlite и так встанут в очередь
 * до готовности движка, но схему нужно успеть создать до первого SELECT —
 * поэтому каждый публичный путь к данным начинается с await ensureSchema().
 * Промис мемоизирован: реальная работа выполняется один раз на процесс.
 */
export function ensureSchema(): Promise<void> {
  if (!globalForDb.__parserSchemaReady) {
    globalForDb.__parserSchemaReady = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await db.execute(sql.raw(statement));
      }
    })().catch((error: unknown) => {
      // Не кэшируем неудачу: следующий вызов попробует ещё раз
      // (например, внешний PostgreSQL ещё поднимался).
      globalForDb.__parserSchemaReady = undefined;
      throw error;
    });
    // Гасим unhandled rejection, если создатель промиса ещё не успел его await-нуть:
    // ошибка всё равно пробросится всем, кто вызовет ensureSchema().
    globalForDb.__parserSchemaReady.catch(() => undefined);
  }
  return globalForDb.__parserSchemaReady;
}
