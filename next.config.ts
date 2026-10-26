import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite подгружает WASM из node_modules в рантайме — бандлить его нельзя.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Дев-сервер за прокси/превью (Arena, Codespaces и т.п.) — иначе Next
  // режет dev-ассеты по origin и страница открывается «без стилей и JS».
  allowedDevOrigins: ["*.e2b.app", "*.app.github.dev"],
};

export default nextConfig;
