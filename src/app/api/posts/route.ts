import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { toPostDTO } from "@/lib/dto";
import { listPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const sinceParam = searchParams.get("since");
  const sinceDate = sinceParam ? new Date(sinceParam) : undefined;

  const { items, total } = await listPosts({
    q: searchParams.get("q")?.trim() || undefined,
    kind: searchParams.get("kind") ?? undefined,
    sourceId: searchParams.get("sourceId") ? Number(searchParams.get("sourceId")) : undefined,
    since: sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : undefined,
    afterId: searchParams.get("afterId") ? Number(searchParams.get("afterId")) : undefined,
    starred: searchParams.get("starred") === "1" || searchParams.get("starred") === "true",
    unread: searchParams.get("unread") === "1" || searchParams.get("unread") === "true",
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 50,
    offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : 0,
  });

  // nextCursor — передай его обратно как ?afterId=, чтобы забрать только новые посты.
  const nextCursor = items.length ? Math.max(...items.map((post) => post.id)) : null;

  return NextResponse.json({
    total,
    count: items.length,
    nextCursor,
    items: items.map(toPostDTO),
  });
}

/** Очистка хранилища: всё или по конкретному источнику. */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("sourceId");

  if (rawId) {
    const sourceId = Number(rawId);
    if (!Number.isFinite(sourceId)) {
      return NextResponse.json({ error: "Некорректный sourceId" }, { status: 400 });
    }
    await db.delete(posts).where(eq(posts.sourceId, sourceId));
  } else {
    await db.delete(posts);
  }

  return NextResponse.json({ ok: true });
}
