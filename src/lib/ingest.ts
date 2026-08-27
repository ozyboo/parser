import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, sources, type NewPost, type Source } from "@/db/schema";
import { parseRssSource } from "@/lib/parsers/rss";
import { normalizeTelegramHandle, parseTelegramSource } from "@/lib/parsers/telegram";
import type { ParseResult, SourceKind } from "@/lib/parsers/types";

export type IngestReport = {
  sourceId: number;
  kind: SourceKind;
  handle: string;
  title: string;
  parsed: number;
  added: number;
  error: string | null;
};

/** Автоопределение типа источника по строке. */
export function detectKind(input: string): SourceKind {
  const value = input.trim().toLowerCase();
  if (
    value.startsWith("@") ||
    value.includes("t.me/") ||
    value.includes("telegram.me/") ||
    /^[a-z0-9_]{3,64}$/.test(value)
  ) {
    return "telegram";
  }
  return "rss";
}

export function normalizeHandle(kind: SourceKind, input: string): string {
  if (kind === "telegram") return normalizeTelegramHandle(input);

  const value = input.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  // Бросит исключение, если url совсем кривой.
  return new URL(withProtocol).toString();
}

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function parseSource(source: Source): Promise<ParseResult> {
  if (source.kind === "telegram") return parseTelegramSource(source.handle);
  return parseRssSource(source.handle);
}

/** Забирает посты источника и складывает их в общее хранилище. */
export async function ingestSource(source: Source): Promise<IngestReport> {
  const report: IngestReport = {
    sourceId: source.id,
    kind: source.kind as SourceKind,
    handle: source.handle,
    title: source.title || source.handle,
    parsed: 0,
    added: 0,
    error: null,
  };

  try {
    const result = await parseSource(source);
    const title = result.title || source.title || source.handle;
    report.title = title;
    report.parsed = result.posts.length;

    if (result.posts.length) {
      const rows: NewPost[] = result.posts.slice(0, 100).map((post) => ({
        sourceId: source.id,
        sourceKind: source.kind,
        sourceTitle: title,
        externalId: post.externalId,
        title: post.title,
        text: post.text,
        html: post.html,
        url: post.url,
        author: post.author,
        imageUrl: post.imageUrl,
        publishedAt: post.publishedAt,
        meta: post.meta ?? {},
      }));

      // Дедупликация внутри одной пачки (иногда фиды отдают дубли guid).
      const unique = new Map<string, NewPost>();
      for (const row of rows) unique.set(row.externalId, row);

      const inserted = await db
        .insert(posts)
        .values([...unique.values()])
        .onConflictDoNothing({ target: [posts.sourceId, posts.externalId] })
        .returning({ id: posts.id });

      report.added = inserted.length;
    }

    await db
      .update(sources)
      .set({
        title,
        lastFetchedAt: new Date(),
        lastError: null,
        lastNewCount: report.added,
      })
      .where(eq(sources.id, source.id));
  } catch (error) {
    report.error = toMessage(error);
    await db
      .update(sources)
      .set({ lastFetchedAt: new Date(), lastError: report.error, lastNewCount: 0 })
      .where(eq(sources.id, source.id));
  }

  return report;
}

/** Обновляет все активные источники (или один конкретный). */
export async function ingestAll(sourceId?: number): Promise<IngestReport[]> {
  const list = sourceId
    ? await db.select().from(sources).where(eq(sources.id, sourceId))
    : await db.select().from(sources).where(eq(sources.enabled, true));

  const reports: IngestReport[] = [];
  const queue = [...list];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      reports.push(await ingestSource(next));
    }
  });

  await Promise.all(workers);
  return reports.sort((a, b) => a.sourceId - b.sourceId);
}

/** Добавляет источник (или возвращает существующий) и сразу тянет посты. */
export async function addSource(input: string, kindInput?: SourceKind) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Пустая ссылка");

  const kind = kindInput ?? detectKind(trimmed);
  const handle = normalizeHandle(kind, trimmed);
  if (!handle) throw new Error("Не удалось разобрать ссылку");

  const existing = await db
    .select()
    .from(sources)
    .where(and(eq(sources.kind, kind), eq(sources.handle, handle)))
    .limit(1);

  const source =
    existing[0] ??
    (
      await db
        .insert(sources)
        .values({ kind, handle, title: kind === "telegram" ? `@${handle}` : handle })
        .returning()
    )[0];

  const report = await ingestSource(source);
  const [fresh] = await db.select().from(sources).where(eq(sources.id, source.id)).limit(1);

  return { source: fresh ?? source, report, existed: Boolean(existing[0]) };
}
