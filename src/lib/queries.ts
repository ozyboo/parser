import { and, asc, desc, eq, gt, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { posts, sources, type Post, type Source } from "@/db/schema";

export type PostFilters = {
  q?: string;
  kind?: string;
  sourceId?: number;
  since?: Date;
  /** Курсор: вернуть только посты с id больше указанного (для инкрементальной выгрузки). */
  afterId?: number;
  /** Только избранные. */
  starred?: boolean;
  /** Только непрочитанные. */
  unread?: boolean;
  limit?: number;
  offset?: number;
};

export type SourceWithStats = Source & { postCount: number };

const orderExpression = sql`coalesce(${posts.publishedAt}, ${posts.fetchedAt}) desc`;

function buildWhere(filters: PostFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(
      ilike(posts.title, pattern),
      ilike(posts.text, pattern),
      ilike(posts.sourceTitle, pattern),
    );
    if (search) conditions.push(search);
  }

  if (filters.kind === "rss" || filters.kind === "telegram") {
    conditions.push(eq(posts.sourceKind, filters.kind));
  }

  if (filters.sourceId) conditions.push(eq(posts.sourceId, filters.sourceId));
  if (filters.since) conditions.push(gte(posts.fetchedAt, filters.since));
  if (filters.afterId) conditions.push(gt(posts.id, filters.afterId));
  if (filters.starred) conditions.push(eq(posts.isStarred, true));
  if (filters.unread) conditions.push(eq(posts.isRead, false));

  if (!conditions.length) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

export async function listPosts(filters: PostFilters): Promise<{ items: Post[]; total: number }> {
  await ensureSchema();
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const where = buildWhere(filters);

  // С курсором отдаём по возрастанию id — удобно тянуть «только новое» пачками.
  const items = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(filters.afterId ? asc(posts.id) : orderExpression)
    .limit(limit)
    .offset(offset);

  const [{ value }] = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(posts)
    .where(where);

  return { items, total: value ?? 0 };
}

export async function listSources(): Promise<SourceWithStats[]> {
  await ensureSchema();
  const rows = await db
    .select({
      source: sources,
      postCount: sql<number>`cast(count(${posts.id}) as int)`,
    })
    .from(sources)
    .leftJoin(posts, eq(posts.sourceId, sources.id))
    .groupBy(sources.id)
    .orderBy(desc(sources.id));

  return rows.map((row) => ({ ...row.source, postCount: row.postCount ?? 0 }));
}

export async function getStats() {
  await ensureSchema();
  const [row] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      rss: sql<number>`cast(count(*) filter (where ${posts.sourceKind} = 'rss') as int)`,
      telegram: sql<number>`cast(count(*) filter (where ${posts.sourceKind} = 'telegram') as int)`,
      last24h: sql<number>`cast(count(*) filter (where ${posts.fetchedAt} > now() - interval '24 hours') as int)`,
      unread: sql<number>`cast(count(*) filter (where ${posts.isRead} = false) as int)`,
      starred: sql<number>`cast(count(*) filter (where ${posts.isStarred} = true) as int)`,
    })
    .from(posts);

  return {
    total: row?.total ?? 0,
    rss: row?.rss ?? 0,
    telegram: row?.telegram ?? 0,
    last24h: row?.last24h ?? 0,
    unread: row?.unread ?? 0,
    starred: row?.starred ?? 0,
  };
}
