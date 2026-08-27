import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Источники контента: RSS-ленты и публичные Telegram-каналы.
 */
export const sources = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    // "rss" | "telegram"
    kind: text("kind").notNull(),
    // Для rss — полный URL фида. Для telegram — username канала (без @).
    handle: text("handle").notNull(),
    title: text("title").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    lastNewCount: integer("last_new_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sources_kind_handle_idx").on(table.kind, table.handle)],
);

/**
 * Единое хранилище постов из всех источников.
 */
export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    sourceKind: text("source_kind").notNull(),
    sourceTitle: text("source_title").notNull().default(""),
    // Уникальный id поста внутри источника (guid / t.me post id).
    externalId: text("external_id").notNull(),
    title: text("title").notNull().default(""),
    // Текст без html — удобно для поиска и чтения.
    text: text("text").notNull().default(""),
    // Оригинальный html (если был).
    html: text("html").notNull().default(""),
    url: text("url").notNull().default(""),
    author: text("author").notNull().default(""),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    // Личные отметки: прочитано / в избранном.
    isRead: boolean("is_read").notNull().default(false),
    isStarred: boolean("is_starred").notNull().default(false),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (table) => [
    uniqueIndex("posts_source_external_idx").on(table.sourceId, table.externalId),
    index("posts_published_idx").on(table.publishedAt),
  ],
);

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
