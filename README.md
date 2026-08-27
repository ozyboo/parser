# Парсер постов: RSS + Telegram

Агрегатор: собирает посты из RSS-лент и публичных Telegram-каналов
в **одно хранилище** (PostgreSQL) и отдаёт их через веб-интерфейс и API.
Авторизации нет — приложение рассчитано на локальный запуск.

## Быстрый старт

```bash
# 1. Зависимости
npm install

# 2. Настройки
cp .env.example .env
#    впиши свой DATABASE_URL

# 3. Создать таблицы в базе
npx drizzle-kit push --config=drizzle.config.json

# 4. Запуск
npm run dev          # разработка → http://localhost:3000
# или
npm run build && npm run start   # продакшн
```

Открываешь `http://localhost:3000` — и сразу работаешь, ничего вводить не нужно.

### Если нет PostgreSQL под рукой

```bash
docker run --name parser-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=app_db -p 5432:5432 -d postgres:16
```

Строка подключения тогда: `postgresql://postgres:postgres@127.0.0.1:5432/app_db`

## Переменные окружения

| Переменная           | Назначение                                                 |
| -------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`       | строка подключения к PostgreSQL                             |
| `AUTO_PARSE_MINUTES` | интервал фонового автопарсинга в минутах (`0` — выключить)  |

## Как это работает

- **RSS** (`src/lib/parsers/rss.ts`) — `fast-xml-parser`, понимает RSS 2.0, Atom и RDF.
- **Telegram** (`src/lib/parsers/telegram.ts`) — читает публичное превью `t.me/s/<канал>`
  через `cheerio`. Без API-ключей и бот-токенов. Работает только с публичными каналами.
- **Хранилище** — таблица `posts`, общая для обоих типов источников.
  Уникальный индекс `(source_id, external_id)` не даёт появиться дублям.
- **Автопарсинг** — `src/instrumentation.ts` запускает обход источников по таймеру
  на сервере, даже когда браузер закрыт.

## API

| Метод    | Путь                                                                   | Описание                                       |
| -------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
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

## Публикация на GitHub

`.gitignore` уже настроен — `node_modules`, `.next` и `.env` в репозиторий не попадут.

```bash
git init
git add .
git commit -m "Парсер постов: RSS + Telegram"
git branch -M main
git remote add origin https://github.com/<логин>/<репозиторий>.git
git push -u origin main
```

> Приложение открыто без пароля. Если будешь выкладывать его в интернет
> (не на localhost) — поставь его за реверс-прокси с basic-auth или VPN.

## Стек

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
PostgreSQL + Drizzle ORM · fast-xml-parser · cheerio · JSZip
