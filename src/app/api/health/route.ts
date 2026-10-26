import { sql } from "drizzle-orm";
import { db, dbKind, ensureSchema } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: dbKind });
  } catch {
    return Response.json({ ok: false, db: dbKind }, { status: 500 });
  }
}
