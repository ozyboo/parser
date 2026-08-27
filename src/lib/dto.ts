import type { Post } from "@/db/schema";
import type { SourceWithStats } from "@/lib/queries";

export type PostDTO = {
  id: number;
  sourceId: number;
  sourceKind: string;
  sourceTitle: string;
  externalId: string;
  title: string;
  text: string;
  url: string;
  author: string;
  imageUrl: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  isRead: boolean;
  isStarred: boolean;
};

export type SourceDTO = {
  id: number;
  kind: string;
  handle: string;
  title: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  lastNewCount: number;
  postCount: number;
};

export type Stats = {
  total: number;
  rss: number;
  telegram: number;
  last24h: number;
  unread: number;
  starred: number;
};

export function toPostDTO(post: Post): PostDTO {
  return {
    id: post.id,
    sourceId: post.sourceId,
    sourceKind: post.sourceKind,
    sourceTitle: post.sourceTitle,
    externalId: post.externalId,
    title: post.title,
    text: post.text,
    url: post.url,
    author: post.author,
    imageUrl: post.imageUrl,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    fetchedAt: (post.fetchedAt ?? new Date()).toISOString(),
    isRead: post.isRead,
    isStarred: post.isStarred,
  };
}

export function toSourceDTO(source: SourceWithStats): SourceDTO {
  return {
    id: source.id,
    kind: source.kind,
    handle: source.handle,
    title: source.title,
    enabled: source.enabled,
    lastFetchedAt: source.lastFetchedAt ? source.lastFetchedAt.toISOString() : null,
    lastError: source.lastError,
    lastNewCount: source.lastNewCount,
    postCount: source.postCount,
  };
}
