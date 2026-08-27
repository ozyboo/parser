"use client";

import { useState } from "react";
import type { PostDTO } from "@/lib/dto";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  post: PostDTO;
  onToggleFlag: (id: number, patch: { isRead?: boolean; isStarred?: boolean }) => void;
};

export function PostCard({ post, onToggleFlag }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isTelegram = post.sourceKind === "telegram";
  const body = post.text || post.title;
  const isLong = body.length > 420;
  const visible = expanded || !isLong ? body : `${body.slice(0, 420)}…`;

  return (
    <article
      id={`post-${post.id}`}
      className={`rounded-2xl border p-4 transition ${
        post.isRead
          ? "border-slate-900 bg-slate-900/25 opacity-60 hover:opacity-100"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
      }`}
    >
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            isTelegram
              ? "bg-sky-500/15 text-sky-300"
              : "bg-amber-500/15 text-amber-300"
          }`}
        >
          {isTelegram ? "Telegram" : "RSS"}
        </span>
        <span className="font-medium text-slate-300">{post.sourceTitle}</span>
        <span className="text-slate-600">•</span>
        <time className="text-slate-500">{formatDate(post.publishedAt ?? post.fetchedAt)}</time>
        <button
          type="button"
          onClick={() => onToggleFlag(post.id, { isStarred: !post.isStarred })}
          title={post.isStarred ? "Убрать из избранного" : "В избранное"}
          className={`ml-auto text-base leading-none transition ${
            post.isStarred ? "text-amber-300" : "text-slate-700 hover:text-amber-300"
          }`}
        >
          {post.isStarred ? "★" : "☆"}
        </button>
        <span className="font-mono text-[11px] text-slate-600">#{post.id}</span>
      </header>

      {post.title && post.title !== body.slice(0, post.title.length) ? (
        <h3 className="mt-2 text-base font-semibold leading-snug text-slate-100">{post.title}</h3>
      ) : null}

      <div className="mt-2 flex gap-3">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt=""
            loading="lazy"
            className="hidden h-24 w-24 shrink-0 rounded-xl object-cover sm:block"
          />
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {visible || "— пусто —"}
        </p>
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            {expanded ? "Свернуть" : "Читать полностью"}
          </button>
        ) : null}
        {post.url ? (
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              if (!post.isRead) onToggleFlag(post.id, { isRead: true });
            }}
            className="text-emerald-400 underline-offset-2 hover:underline"
          >
            Открыть оригинал ↗
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => onToggleFlag(post.id, { isRead: !post.isRead })}
          className="text-slate-500 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          {post.isRead ? "Вернуть в непрочитанные" : "Отметить прочитанным"}
        </button>
        {post.author ? <span className="text-slate-500">{post.author}</span> : null}
      </footer>
    </article>
  );
}
