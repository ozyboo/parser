import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";

export const dynamic = "force-dynamic";

/** Отметить всё (или посты одного источника) прочитанным. */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("sourceId");

  if (rawId) {
    const sourceId = Number(rawId);
    if (!Number.isFinite(sourceId)) {
      return NextResponse.json({ error: "Некорректный sourceId" }, { status: 400 });
    }
    const updated = await db
      .update(posts)
      .set({ isRead: true })
      .where(eq(posts.sourceId, sourceId))
      .returning({ id: posts.id });
    return NextResponse.json({ ok: true, updated: updated.length });
  }

  const updated = await db
    .update(posts)
    .set({ isRead: true })
    .where(eq(posts.isRead, false))
    .returning({ id: posts.id });

  return NextResponse.json({ ok: true, updated: updated.length });
}
