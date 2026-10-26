import { defineConfig } from "drizzle-kit";

// Нужен только для внешнего PostgreSQL (DATABASE_URL).
// Без него приложение использует встроенную базу и создаёт таблицы само.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
