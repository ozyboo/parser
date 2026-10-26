"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { SourceRow } from "@/components/source-row";
import type { PostDTO, SourceDTO, Stats } from "@/lib/dto";

const PAGE_SIZE = 30;

const SUGGESTIONS: { label: string; value: string; kind: "rss" | "telegram" }[] = [
  { label: "Habr (RSS)", value: "https://habr.com/ru/rss/articles/?fl=ru", kind: "rss" },
  { label: "Hacker News (RSS)", value: "https://news.ycombinator.com/rss", kind: "rss" },
  { label: "Lenta.ru (RSS)", value: "https://lenta.ru/rss/news", kind: "rss" },
  { label: "@durov", value: "durov", kind: "telegram" },
  { label: "@telegram", value: "telegram", kind: "telegram" },
];

type Props = {
  initialSources: SourceDTO[];
  initialPosts: PostDTO[];
  initialTotal: number;
  initialStats: Stats;
};

export function Dashboard({ initialSources, initialPosts, initialTotal, initialStats }: Props) {
  const [sources, setSources] = useState(initialSources);
  const [posts, setPosts] = useState(initialPosts);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState(initialStats);

  const [input, setInput] = useState("");
  const [kindInput, setKindInput] = useState<"auto" | "rss" | "telegram">("auto");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "rss" | "telegram">("all");
  const [sourceFilter, setSourceFilter] = useState<number | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [busySource, setBusySource] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const firstRender = useRef(true);

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (query.trim()) params.set("q", query.trim());
      if (kindFilter !== "all") params.set("kind", kindFilter);
      if (sourceFilter) params.set("sourceId", String(sourceFilter));
      if (onlyUnread) params.set("unread", "1");
      if (onlyStarred) params.set("starred", "1");
      return params;
    },
    [query, kindFilter, sourceFilter, onlyUnread, onlyStarred],
  );

  const loadPosts = useCallback(
    async (offset = 0) => {
      setLoadingPosts(true);
      try {
        const response = await fetch(`/api/posts?${buildParams(offset).toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { items: PostDTO[]; total: number };
        setTotal(data.total);
        setPosts((current) => (offset === 0 ? data.items : [...current, ...data.items]));
      } finally {
        setLoadingPosts(false);
      }
    },
    [buildParams],
  );

  const loadSidebar = useCallback(async () => {
    const [sourcesResponse, statsResponse] = await Promise.all([
      fetch("/api/sources", { cache: "no-store" }),
      fetch("/api/stats", { cache: "no-store" }),
    ]);
    const sourcesData = (await sourcesResponse.json()) as { items: SourceDTO[] };
    setSources(sourcesData.items);
    setStats((await statsResponse.json()) as Stats);
  }, []);

  // Перезагружаем ленту при смене фильтров (поиск — с дебаунсом).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void loadPosts(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadPosts]);

  const parse = useCallback(
    async (sourceId?: number) => {
      if (sourceId) setBusySource(sourceId);
      else setRefreshingAll(true);

      try {
        const url = sourceId ? `/api/parse?sourceId=${sourceId}` : "/api/parse";
        const response = await fetch(url, { method: "POST" });
        const data = (await response.json()) as {
          added?: number;
          sources?: number;
          reports?: { error: string | null; title: string }[];
          error?: string;
        };

        const failed = (data.reports ?? []).filter((report) => report.error);
        if (data.error) {
          setMessage({ type: "err", text: data.error });
        } else if (failed.length) {
          setMessage({
            type: "err",
            text: `Добавлено ${data.added ?? 0}. Ошибки: ${failed
              .map((report) => `${report.title} — ${report.error}`)
              .join("; ")}`,
          });
        } else {
          setMessage({
            type: "ok",
            text: `Готово: ${data.sources ?? 0} источник(ов), новых постов — ${data.added ?? 0}`,
          });
        }

        await Promise.all([loadPosts(0), loadSidebar()]);
      } catch (error) {
        setMessage({ type: "err", text: error instanceof Error ? error.message : "Ошибка сети" });
      } finally {
        setBusySource(null);
        setRefreshingAll(false);
      }
    },
    [loadPosts, loadSidebar],
  );

  // Автообновление раз в 5 минут.
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => void parse(), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, parse]);

  async function addSource(value: string, kind: "auto" | "rss" | "telegram") {
    const url = value.trim();
    if (!url) return;

    setAdding(true);
    setMessage(null);
    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, kind: kind === "auto" ? undefined : kind }),
      });
      const data = (await response.json()) as {
        error?: string;
        existed?: boolean;
        report?: { added: number; parsed: number; error: string | null; title: string };
      };

      if (!response.ok || data.error) {
        setMessage({ type: "err", text: data.error ?? "Не удалось добавить источник" });
      } else if (data.report?.error) {
        setMessage({ type: "err", text: `Источник добавлен, но парсинг упал: ${data.report.error}` });
      } else {
        setMessage({
          type: "ok",
          text: `${data.existed ? "Обновлён" : "Добавлен"} «${data.report?.title ?? url}»: спаршено ${
            data.report?.parsed ?? 0
          }, новых ${data.report?.added ?? 0}`,
        });
        setInput("");
      }

      await Promise.all([loadPosts(0), loadSidebar()]);
    } catch (error) {
      setMessage({ type: "err", text: error instanceof Error ? error.message : "Ошибка сети" });
    } finally {
      setAdding(false);
    }
  }

  async function toggleSource(id: number, enabled: boolean) {
    await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await loadSidebar();
  }

  async function deleteSource(id: number) {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (sourceFilter === id) setSourceFilter(null);
    await Promise.all([loadPosts(0), loadSidebar()]);
  }

  /** Оптимистично переключает «прочитано» / «избранное». */
  function toggleFlag(id: number, patch: { isRead?: boolean; isStarred?: boolean }) {
    setPosts((current) =>
      current.map((post) => (post.id === id ? { ...post, ...patch } : post)),
    );
    setStats((current) => ({
      ...current,
      unread:
        patch.isRead === undefined
          ? current.unread
          : Math.max(0, current.unread + (patch.isRead ? -1 : 1)),
      starred:
        patch.isStarred === undefined
          ? current.starred
          : Math.max(0, current.starred + (patch.isStarred ? 1 : -1)),
    }));

    void fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function markAllRead() {
    const url = sourceFilter ? `/api/posts/read-all?sourceId=${sourceFilter}` : "/api/posts/read-all";
    await fetch(url, { method: "POST" });
    await Promise.all([loadPosts(0), loadSidebar()]);
  }



  const statCards = [
    { label: "Всего постов", value: stats.total },
    { label: "Непрочитанных", value: stats.unread },
    { label: "В избранном", value: stats.starred },
    { label: "RSS / Telegram", value: `${stats.rss} / ${stats.telegram}` },
    { label: "За 24 часа", value: stats.last24h },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Парсер постов: RSS + Telegram
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Всё складывается в одну таблицу <code className="text-slate-300">posts</code> — забирай
            через <code className="text-slate-300">/api/posts</code> или{" "}
            <code className="text-slate-300">/api/feed.xml</code>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            авто каждые 5 мин
          </label>
          <button
            type="button"
            onClick={() => void parse()}
            disabled={refreshingAll || !sources.length}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {refreshingAll ? "Парсим…" : "Спарсить всё"}
          </button>
          <a
            href="/api/export"
            className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400 transition hover:border-emerald-500 hover:text-emerald-300"
            title="Скачать исходники проекта одним zip (без node_modules)"
          >
            ⤓ Скачать код
          </a>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3"
          >
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-100">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="text-sm font-semibold text-slate-200">Добавить источник</h2>
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void addSource(input, kindInput);
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="https://site.com/rss или @channel"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <select
                  value={kindInput}
                  onChange={(event) =>
                    setKindInput(event.target.value as "auto" | "rss" | "telegram")
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-300 outline-none focus:border-emerald-500"
                >
                  <option value="auto">авто</option>
                  <option value="rss">RSS</option>
                  <option value="telegram">Telegram</option>
                </select>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-white disabled:opacity-40"
                >
                  {adding ? "Парсим…" : "Добавить и спарсить"}
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={adding}
                onClick={() => void addSource(`${window.location.origin}/demo-feed.xml`, "rss")}
                className="rounded-full border border-emerald-700/60 px-2.5 py-1 text-[11px] text-emerald-300 transition hover:border-emerald-400 disabled:opacity-40"
                title="Локальная тестовая лента из public/demo-feed.xml — интернет не нужен"
              >
                + Демо-лента (без интернета)
              </button>
              {SUGGESTIONS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  disabled={adding}
                  onClick={() => void addSource(item.value, item.kind)}
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40"
                >
                  + {item.label}
                </button>
              ))}
            </div>

            {message ? (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                  message.type === "ok"
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "bg-rose-500/10 text-rose-300"
                }`}
              >
                {message.text}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">
                Источники ({sources.length})
              </h2>
              {sourceFilter ? (
                <button
                  type="button"
                  onClick={() => setSourceFilter(null)}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  сбросить фильтр
                </button>
              ) : null}
            </div>

            {sources.length ? (
              <ul className="mt-3 space-y-2">
                {sources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    busy={busySource === source.id}
                    active={sourceFilter === source.id}
                    onRefresh={(id) => void parse(id)}
                    onToggle={(id, enabled) => void toggleSource(id, enabled)}
                    onDelete={(id) => void deleteSource(id)}
                    onFilter={(id) => setSourceFilter((current) => (current === id ? null : id))}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Пока пусто. Добавь RSS-ссылку или юзернейм публичного Telegram-канала.
              </p>
            )}
          </section>
        </aside>

        <section>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по тексту постов…"
              className="min-w-[200px] flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
            <div className="flex overflow-hidden rounded-lg border border-slate-800">
              {(["all", "rss", "telegram"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKindFilter(value)}
                  className={`px-3 py-2 text-xs transition ${
                    kindFilter === value
                      ? "bg-slate-100 text-slate-900"
                      : "bg-slate-900/60 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {value === "all" ? "Все" : value === "rss" ? "RSS" : "Telegram"}
                </button>
              ))}
            </div>
            <a
              href={`/api/posts?${buildParams(0).toString()}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              JSON ↗
            </a>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setOnlyUnread((value) => !value)}
              className={`rounded-full border px-3 py-1 transition ${
                onlyUnread
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Непрочитанные
            </button>
            <button
              type="button"
              onClick={() => setOnlyStarred((value) => !value)}
              className={`rounded-full border px-3 py-1 transition ${
                onlyStarred
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              ★ Избранное
            </button>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="rounded-full border border-slate-800 px-3 py-1 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
            >
              Прочитать всё{sourceFilter ? " в источнике" : ""}
            </button>
            <span className="ml-auto text-slate-500">
              Показано {posts.length} из {total}
              {loadingPosts ? " · загрузка…" : ""}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onToggleFlag={toggleFlag} />
            ))}
          </div>

          {!posts.length && !loadingPosts ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">
              Постов нет. Добавь источник слева и нажми «Спарсить всё».
            </div>
          ) : null}

          {posts.length < total ? (
            <button
              type="button"
              onClick={() => void loadPosts(posts.length)}
              disabled={loadingPosts}
              className="mt-4 w-full rounded-lg border border-slate-800 py-2.5 text-sm text-slate-300 transition hover:border-emerald-500 hover:text-emerald-300 disabled:opacity-40"
            >
              {loadingPosts ? "Загрузка…" : "Показать ещё"}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
