/**
 * Фоновый автопарсинг: сервер сам обновляет источники по расписанию,
 * чтобы к моменту открытия сайта посты уже были в хранилище.
 * Интервал задаётся в .env: AUTO_PARSE_MINUTES (0 — выключить).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const minutes = Number(process.env.AUTO_PARSE_MINUTES ?? "15");
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  const globalScope = globalThis as typeof globalThis & { __parserAutoTimer?: NodeJS.Timeout };
  if (globalScope.__parserAutoTimer) return;

  const tick = async () => {
    try {
      const { ingestAll } = await import("@/lib/ingest");
      const reports = await ingestAll();
      const added = reports.reduce((sum, report) => sum + report.added, 0);
      if (reports.length) {
        console.log(`[auto-parse] источников: ${reports.length}, новых постов: ${added}`);
      }
    } catch (error) {
      console.error("[auto-parse] ошибка:", error);
    }
  };

  const timer = setInterval(() => void tick(), minutes * 60 * 1000);
  // Не держим процесс живым только ради таймера.
  timer.unref?.();
  globalScope.__parserAutoTimer = timer;

  // Первый прогон через минуту после старта, чтобы не мешать healthcheck.
  const warmup = setTimeout(() => void tick(), 60_000);
  warmup.unref?.();

  console.log(`[auto-parse] включён, интервал ${minutes} мин`);
}
