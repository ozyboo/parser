import * as cheerio from "cheerio";
import {
  fetchText,
  firstLine,
  htmlToText,
  parseDate,
  type ParsedPost,
  type ParseResult,
} from "./types";

/** Из "@durov", "https://t.me/durov", "t.me/s/durov" делает "durov". */
export function normalizeTelegramHandle(input: string): string {
  const raw = input.trim().replace(/^@/, "");
  const match = raw.match(/(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z0-9_]+)/i);
  const handle = match ? match[1] : raw;
  return handle.replace(/[^A-Za-z0-9_]/g, "");
}

function extractBackgroundImage(style: string | undefined): string | null {
  if (!style) return null;
  const match = style.match(/background-image\s*:\s*url\(['"]?(.*?)['"]?\)/i);
  return match ? match[1] : null;
}

export async function parseTelegramSource(handleInput: string): Promise<ParseResult> {
  const handle = normalizeTelegramHandle(handleInput);
  if (!handle) throw new Error("Некорректный юзернейм Telegram-канала");

  const html = await fetchText(`https://t.me/s/${handle}`);
  const $ = cheerio.load(html);

  const channelTitle =
    $(".tgme_channel_info_header_title span").first().text().trim() ||
    $(".tgme_header_title span").first().text().trim() ||
    `@${handle}`;

  const posts: ParsedPost[] = [];

  $(".tgme_widget_message").each((_, element) => {
    const node = $(element);
    const dataPost = node.attr("data-post"); // "channel/123"
    if (!dataPost) return;

    const postId = dataPost.split("/")[1] ?? "";
    const bodyHtml = node.find(".tgme_widget_message_text").first().html() ?? "";
    const text = htmlToText(bodyHtml);

    const imageUrl =
      extractBackgroundImage(node.find(".tgme_widget_message_photo_wrap").first().attr("style")) ??
      extractBackgroundImage(
        node.find(".tgme_widget_message_video_thumb").first().attr("style"),
      ) ??
      null;

    const hasVideo = node.find(".tgme_widget_message_video").length > 0;
    const hasPoll = node.find(".tgme_widget_message_poll").length > 0;
    const views = node.find(".tgme_widget_message_views").first().text().trim();
    const author = node.find(".tgme_widget_message_from_author").first().text().trim();
    const datetime = node.find(".tgme_widget_message_date time").first().attr("datetime");

    const forwarded = node.find(".tgme_widget_message_forwarded_from_name").first().text().trim();

    if (!text && !imageUrl && !hasVideo && !hasPoll) return;

    posts.push({
      externalId: postId || dataPost,
      title: firstLine(text) || (imageUrl ? "📷 Медиа-пост" : `Пост ${dataPost}`),
      text,
      html: bodyHtml,
      url: `https://t.me/${dataPost}`,
      author: author || `@${handle}`,
      imageUrl,
      publishedAt: parseDate(datetime),
      meta: {
        channel: handle,
        views: views || null,
        hasVideo,
        hasPoll,
        forwardedFrom: forwarded || null,
      },
    });
  });

  if (!posts.length && !html.includes("tgme_channel_info")) {
    throw new Error(
      `Канал @${handle} не найден или закрыт (публичный превью t.me/s/${handle} недоступен)`,
    );
  }

  return { title: channelTitle.slice(0, 200), posts };
}
