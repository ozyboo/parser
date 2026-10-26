import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { sources } from "@/db/schema";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  await ensureSchema();
  const { id } = await context.params;
  const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  let body: { enabled?: boolean } = {};
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    body = {};
  }

  const [updated] = await db
    .update(sources)
    .set({ enabled: Boolean(body.enabled) })
    .where(eq(sources.id, sourceId))
    .returning();

  if (!updated) return NextResponse.json({ error: "Источник не найден" }, { status: 404 });
  return NextResponse.json({ source: updated });
}

export async function DELETE(_request: Request, context: Context) {
  await ensureSchema();
  const { id } = await context.params;
  const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  await db.delete(sources).where(eq(sources.id, sourceId));
  return NextResponse.json({ ok: true });
}
