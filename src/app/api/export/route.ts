import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Что НЕ кладём в архив — именно из-за этого обычная выгрузка весит сотни мегабайт. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  ".vercel",
  "out",
  "build",
  "dist",
  "coverage",
]);

// .env не кладём в архив — там секреты. Вместо него едет .env.example.
const SKIP_FILES = new Set([".DS_Store", "next-env.d.ts", ".env", ".env.local"]);

const MAX_FILE_BYTES = 2 * 1024 * 1024;

async function collect(root: string, current: string, zip: JSZip): Promise<number> {
  let count = 0;
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      count += await collect(root, path.join(current, entry.name), zip);
      continue;
    }

    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name)) continue;
    if (entry.name.endsWith(".zip") || entry.name.endsWith(".tsbuildinfo")) continue;

    const absolute = path.join(current, entry.name);
    const info = await stat(absolute);
    if (info.size > MAX_FILE_BYTES) continue;

    const relative = path.relative(root, absolute).split(path.sep).join("/");
    zip.file(relative, await readFile(absolute));
    count += 1;
  }

  return count;
}

/** Скачивание исходников проекта одним zip-архивом (без node_modules и .next). */
export async function GET() {
  try {
    const root = process.cwd();
    const zip = new JSZip();

    const files = await collect(root, root, zip);

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="parser-postov-${stamp}.zip"`,
        "content-length": String(buffer.byteLength),
        "x-files-count": String(files),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось собрать архив" },
      { status: 500 },
    );
  }
}
