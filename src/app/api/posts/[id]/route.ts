import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { posts } from "@/db/schema";
import { toPostDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Отметки «прочитано» / «в избранном» для конкретного поста. */
export async function PATCH(request: Request, context: Context) {
  await ensureSchema();
  const { id } = await context.params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  let body: { isRead?: boolean; isStarred?: boolean } = {};
  try {
    body = (await request.json()) as { isRead?: boolean; isStarred?: boolean };
  } catch {
    body = {};
  }

  const patch: { isRead?: boolean; isStarred?: boolean } = {};
  if (typeof body.isRead === "boolean") patch.isRead = body.isRead;
  if (typeof body.isStarred === "boolean") patch.isStarred = body.isStarred;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Нечего обновлять" }, { status: 400 });
  }

  const [updated] = await db.update(posts).set(patch).where(eq(posts.id, postId)).returning();
  if (!updated) return NextResponse.json({ error: "Пост не найден" }, { status: 404 });

  return NextResponse.json({ post: toPostDTO(updated) });
}

export async function DELETE(_request: Request, context: Context) {
  await ensureSchema();
  const { id } = await context.params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  await db.delete(posts).where(eq(posts.id, postId));
  return NextResponse.json({ ok: true });
}
