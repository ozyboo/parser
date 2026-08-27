"use client";

import type { SourceDTO } from "@/lib/dto";

function relative(value: string | null): string {
  if (!value) return "ещё не обновлялся";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}

type Props = {
  source: SourceDTO;
  busy: boolean;
  onRefresh: (id: number) => void;
  onToggle: (id: number, enabled: boolean) => void;
  onDelete: (id: number) => void;
  onFilter: (id: number) => void;
  active: boolean;
};

export function SourceRow({ source, busy, onRefresh, onToggle, onDelete, onFilter, active }: Props) {
  const isTelegram = source.kind === "telegram";

  return (
    <li
      className={`rounded-xl border p-3 transition ${
        active ? "border-emerald-500/60 bg-emerald-500/5" : "border-slate-800 bg-slate-900/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isTelegram ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {isTelegram ? "TG" : "RSS"}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onFilter(source.id)}
            className="block max-w-full truncate text-left text-sm font-medium text-slate-100 hover:text-emerald-300"
            title="Показать только этот источник"
          >
            {source.title || source.handle}
          </button>
          <p className="truncate text-[11px] text-slate-500" title={source.handle}>
            {isTelegram ? `t.me/${source.handle}` : source.handle}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {source.postCount} постов · {relative(source.lastFetchedAt)}
            {source.lastNewCount > 0 ? ` · +${source.lastNewCount} новых` : ""}
          </p>
          {source.lastError ? (
            <p className="mt-1 line-clamp-2 rounded bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
              {source.lastError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRefresh(source.id)}
          className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 transition hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40"
        >
          {busy ? "Парсим…" : "Обновить"}
        </button>
        <button
          type="button"
          onClick={() => onToggle(source.id, !source.enabled)}
          className={`rounded-md border px-2 py-1 transition ${
            source.enabled
              ? "border-emerald-600/50 text-emerald-300 hover:bg-emerald-500/10"
              : "border-slate-700 text-slate-500 hover:text-slate-300"
          }`}
        >
          {source.enabled ? "Активен" : "Выключен"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(source.id)}
          className="ml-auto rounded-md border border-slate-800 px-2 py-1 text-slate-500 transition hover:border-rose-600/60 hover:text-rose-300"
        >
          Удалить
        </button>
      </div>
    </li>
  );
}
