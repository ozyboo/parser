import { XMLParser } from "fast-xml-parser";
import {
  fetchText,
  firstLine,
  htmlToText,
  parseDate,
  type ParsedPost,
  type ParseResult,
} from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  cdataPropName: "__cdata",
});

type AnyRecord = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Достаёт текст из значения, которое может быть строкой, объектом с #text/__cdata и т.д. */
function pickText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return pickText(value[0]);
  if (typeof value === "object") {
    const record = value as AnyRecord;
    if (record.__cdata !== undefined) return pickText(record.__cdata);
    if (record["#text"] !== undefined) return pickText(record["#text"]);
  }
  return "";
}

function pickLink(entry: AnyRecord): string {
  const link = entry.link;

  if (typeof link === "string") return link;

  if (Array.isArray(link)) {
    const alternate = link.find(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        ((item as AnyRecord)["@_rel"] === undefined ||
          (item as AnyRecord)["@_rel"] === "alternate"),
    );
    const target = (alternate ?? link[0]) as AnyRecord | string;
    return typeof target === "string" ? target : String(target?.["@_href"] ?? pickText(target));
  }

  if (typeof link === "object" && link !== null) {
    const record = link as AnyRecord;
    return String(record["@_href"] ?? pickText(record));
  }

  return pickText(entry.guid) || pickText(entry.id) || "";
}

function pickImage(entry: AnyRecord, html: string): string | null {
  const enclosures = asArray(entry.enclosure as AnyRecord | AnyRecord[] | undefined);
  for (const enclosure of enclosures) {
    const type = String(enclosure?.["@_type"] ?? "");
    const url = String(enclosure?.["@_url"] ?? "");
    if (url && (type.startsWith("image") || /\.(jpe?g|png|webp|gif)/i.test(url))) return url;
  }

  const mediaKeys = ["media:content", "media:thumbnail", "itunes:image"];
  for (const key of mediaKeys) {
    const media = asArray(entry[key] as AnyRecord | AnyRecord[] | undefined);
    for (const item of media) {
      const url = String(item?.["@_url"] ?? item?.["@_href"] ?? "");
      if (url) return url;
    }
  }

  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function pickAuthor(entry: AnyRecord): string {
  const candidates = [entry["dc:creator"], entry.author, entry.creator];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === "object") {
      const record = candidate as AnyRecord;
      const name = pickText(record.name) || pickText(record);
      if (name.trim()) return name.trim();
    }
  }
  return "";
}

export async function parseRssSource(feedUrl: string): Promise<ParseResult> {
  const xml = await fetchText(feedUrl);
  const document = parser.parse(xml) as AnyRecord;

  const rss = document.rss as AnyRecord | undefined;
  const rdf = document["rdf:RDF"] as AnyRecord | undefined;
  const channel = (rss?.channel ?? rdf?.channel ?? document.channel) as AnyRecord | undefined;
  const feed = document.feed as AnyRecord | undefined;

  const rawItems = channel
    ? asArray((channel.item ?? rdf?.item) as AnyRecord | AnyRecord[] | undefined)
    : asArray(feed?.entry as AnyRecord | AnyRecord[] | undefined);

  const items = rawItems.length
    ? rawItems
    : asArray(document.item as AnyRecord | AnyRecord[] | undefined);

  const feedTitle =
    pickText(channel?.title) || pickText(feed?.title) || new URL(feedUrl).hostname;

  const posts: ParsedPost[] = [];

  for (const item of items) {
    const html =
      pickText(item["content:encoded"]) ||
      pickText(item.content) ||
      pickText(item.description) ||
      pickText(item.summary) ||
      "";

    const text = htmlToText(html);
    const url = pickLink(item);
    const title = htmlToText(pickText(item.title)) || firstLine(text) || url;

    const externalId =
      pickText(item.guid) ||
      pickText(item.id) ||
      url ||
      `${feedUrl}#${title}`.slice(0, 400);

    if (!externalId) continue;

    posts.push({
      externalId: externalId.slice(0, 500),
      title: title.slice(0, 500),
      text,
      html,
      url,
      author: pickAuthor(item),
      imageUrl: pickImage(item, html),
      publishedAt:
        parseDate(pickText(item.pubDate)) ??
        parseDate(pickText(item.published)) ??
        parseDate(pickText(item.updated)) ??
        parseDate(pickText(item["dc:date"])),
      meta: { feedUrl },
    });
  }

  return { title: htmlToText(feedTitle).slice(0, 200), posts };
}
