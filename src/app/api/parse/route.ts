import { NextResponse } from "next/server";
import { ingestAll } from "@/lib/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("sourceId");
  const sourceId = rawId ? Number(rawId) : undefined;

  if (rawId && !Number.isFinite(sourceId)) {
    return NextResponse.json({ error: "Некорректный sourceId" }, { status: 400 });
  }

  const startedAt = Date.now();
  const reports = await ingestAll(sourceId);

  return NextResponse.json({
    ok: true,
    tookMs: Date.now() - startedAt,
    sources: reports.length,
    added: reports.reduce((sum, report) => sum + report.added, 0),
    parsed: reports.reduce((sum, report) => sum + report.parsed, 0),
    reports,
  });
}

// POST — основной способ, GET — чтобы удобно дёргать из cron/браузера.
export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
