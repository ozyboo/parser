const ENDPOINTS: { method: string; path: string; description: string }[] = [
  {
    method: "GET",
    path: "/api/posts?limit=50&offset=0&q=&kind=rss|telegram&sourceId=&since=ISO",
    description: "Единое хранилище постов в JSON. Основной способ забирать данные.",
  },
  {
    method: "GET",
    path: "/api/posts?afterId=<nextCursor>&limit=100",
    description:
      "Инкрементальная выгрузка: только посты новее курсора. Курсор возвращается в поле nextCursor.",
  },
  {
    method: "GET",
    path: "/api/feed.xml",
    description: "Все посты одной RSS-лентой (можно подписаться любым ридером).",
  },
  {
    method: "POST",
    path: "/api/parse?sourceId=<id>",
    description: "Запустить парсинг всех активных источников (или одного). Подходит для cron.",
  },
  {
    method: "GET",
    path: "/api/sources",
    description: "Список источников со статистикой.",
  },
  {
    method: "POST",
    path: "/api/sources",
    description: 'Добавить источник: {"url":"https://site/rss"} или {"url":"@channel"}.',
  },
  {
    method: "PATCH",
    path: "/api/posts/<id>",
    description: 'Отметки: {"isRead":true} / {"isStarred":true}. POST /api/posts/read-all — всё прочитано.',
  },
  {
    method: "DELETE",
    path: "/api/sources/<id> · /api/posts?sourceId=<id>",
    description: "Удалить источник (с постами) или очистить посты хранилища.",
  },
  {
    method: "GET",
    path: "/api/export",
    description:
      "Скачать исходники проекта одним zip (~500 КБ, без node_modules и .next).",
  },
];

export function ApiDocs() {
  return (
    <section className="mx-auto mt-10 max-w-7xl px-4 pb-12 sm:px-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="text-sm font-semibold text-slate-200">API хранилища</h2>
        <p className="mt-1 text-xs text-slate-500">
          Схема хранения: таблица <code className="text-slate-300">posts</code> (source_id,
          source_kind, external_id, title, text, html, url, author, image_url, published_at,
          fetched_at, meta) с уникальным индексом (source_id, external_id) — дубли не попадают.
        </p>
        <ul className="mt-4 space-y-2">
          {ENDPOINTS.map((endpoint) => (
            <li
              key={endpoint.path}
              className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
            >
              <span
                className={`w-fit rounded px-2 py-0.5 text-[11px] font-semibold ${
                  endpoint.method === "GET"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : endpoint.method === "POST"
                      ? "bg-sky-500/15 text-sky-300"
                      : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {endpoint.method}
              </span>
              <code className="break-all font-mono text-xs text-slate-300">{endpoint.path}</code>
              <span className="text-[11px] text-slate-500 sm:ml-auto sm:text-right">
                {endpoint.description}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Всё открыто без авторизации — приложение рассчитано на локальный запуск. Сервер сам парсит
          источники каждые <code className="text-slate-300">AUTO_PARSE_MINUTES</code> минут (задаётся
          в <code className="text-slate-300">.env</code>), даже если вкладка закрыта.
          <br />
          Cron-пример:{" "}
          <code className="text-slate-300">*/15 * * * * curl -X POST http://localhost:3000/api/parse</code>
        </p>
      </div>
    </section>
  );
}
