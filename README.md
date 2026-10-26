# Парсер постов: RSS + Telegram

Агрегатор: собирает посты из RSS-лент и публичных Telegram-каналов
в **одно хранилище** (PostgreSQL) и отдаёт их через веб-интерфейс и API.
Авторизации нет — приложение рассчитано на локальный запуск.

## Быстрый старт

```bash
npm install
npm run dev          # разработка → http://localhost:3000
# или
npm run build && npm run start   # продакшн
```

Всё. Никакой настройки не нужно: если внешний PostgreSQL не задан,
приложение само поднимает **встроенную базу** (PGlite — настоящий PostgreSQL
в WASM, данные в `./data/pg`) и само создаёт таблицы.

Открываешь `http://localhost:3000` — и сразу работаешь. Для быстрой проверки
без интернета там есть кнопка **«Демо-лента (без интернета)»** — локальный RSS
из `public/demo-feed.xml`.

### Если нужен настоящий PostgreSQL

Задай `DATABASE_URL` (файл `.env`, образец — `.env.example`) — приложение
переключится на внешний сервер, таблицы по-прежнему создадутся сами:

```bash
docker run --name parser-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=app_db -p 5432:5432 -d postgres:16
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

> ⚠️ Это серверное приложение (API + база + фоновый парсинг), на GitHub Pages
> оно не заработает — Pages отдаёт только статику. Для публикации нужен
> Node-хостинг (VPS, Railway, Render и т.п.); в репозитории настроен CI,
> который проверяет сборку и рабочий сценарий на каждый пуш.

## Переменные окружения

| Переменная           | Назначение                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`       | (необязательно) внешний PostgreSQL; пусто — встроенная база `./data/pg`     |
| `PGLITE_DATA_DIR`    | (необязательно) свой каталог встроенной базы                                |
| `AUTO_PARSE_MINUTES` | интервал фонового автопарсинга в минутах (`0` — выключить), по умолчанию 15 |

## Как это работает

- **RSS** (`src/lib/parsers/rss.ts`) — `fast-xml-parser`, понимает RSS 2.0, Atom и RDF.
- **Telegram** (`src/lib/parsers/telegram.ts`) — читает публичное превью `t.me/s/<канал>`
  через `cheerio`. Без API-ключей и бот-токенов. Работает только с публичными каналами.
- **Хранилище** — таблица `posts`, общая для обоих типов источников.
  Уникальный индекс `(source_id, external_id)` не даёт появиться дублям.
- **Автопарсинг** — `src/instrumentation.ts` запускает обход источников по таймеру
  на сервере, даже когда браузер закрыт.
- Схема базы создаётся автоматически (`ensureSchema` в `src/db/index.ts`), поэтому
  `drizzle-kit push` не нужен; конфиг `drizzle.config.ts` оставлен для ручных операций
  с внешним PostgreSQL (`npm run db:push`).

## API

| Метод    | Путь                                                                   | Описание                                       |
| -------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| `GET`    | `/api/health`                                                          | живость + режим базы (`embedded`/`postgres`)   |
| `GET`    | `/api/posts?limit=&offset=&q=&kind=&sourceId=&since=&unread=&starred=`  | посты из хранилища                             |
| `GET`    | `/api/posts?afterId=<nextCursor>`                                      | инкрементальная выгрузка «только новое»         |
| `GET`    | `/api/feed.xml`                                                        | всё хранилище одной RSS-лентой                  |
| `POST`   | `/api/parse?sourceId=<id>`                                             | запустить парсинг (всех источников или одного)  |
| `GET`    | `/api/sources`                                                         | список источников со статистикой                |
| `POST`   | `/api/sources`                                                         | добавить: `{"url":"https://site/rss"}` или `{"url":"@channel"}` |
| `PATCH`  | `/api/posts/<id>`                                                      | `{"isRead":true}` / `{"isStarred":true}`        |
| `POST`   | `/api/posts/read-all`                                                  | отметить всё прочитанным                        |
| `DELETE` | `/api/sources/<id>`                                                    | удалить источник вместе с постами               |
| `GET`    | `/api/export`                                                          | скачать исходники проекта одним zip             |

Пример cron для регулярного парсинга:

```
*/15 * * * * curl -X POST http://localhost:3000/api/parse
```

> Приложение открыто без пароля. Если будешь выкладывать его в интернет
> (не на localhost) — поставь его за реверс-прокси с basic-auth или VPN.

## Стек

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
PostgreSQL + Drizzle ORM (внешний или встроенный PGlite) ·
fast-xml-parser · cheerio · JSZip
