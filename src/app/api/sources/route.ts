import { NextResponse } from "next/server";
import { addSource, detectKind } from "@/lib/ingest";
import { listSources } from "@/lib/queries";
import type { SourceKind } from "@/lib/parsers/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listSources();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 });
  }

  const payload = (body ?? {}) as { url?: string; kind?: string };
  const url = (payload.url ?? "").trim();

  if (!url) {
    return NextResponse.json({ error: "Укажите url или @канал" }, { status: 400 });
  }

  const kind: SourceKind =
    payload.kind === "rss" || payload.kind === "telegram"
      ? payload.kind
      : detectKind(url);

  try {
    const result = await addSource(url, kind);
    return NextResponse.json(result, { status: result.existed ? 200 : 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось добавить источник" },
      { status: 400 },
    );
  }
}
