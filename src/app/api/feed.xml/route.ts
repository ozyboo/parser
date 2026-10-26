import { listPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Единая RSS-лента из всего хранилища — удобно забирать любым ридером. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const { items } = await listPosts({
    q: searchParams.get("q")?.trim() || undefined,
    kind: searchParams.get("kind") ?? undefined,
    sourceId: searchParams.get("sourceId") ? Number(searchParams.get("sourceId")) : undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 100,
  });

  const entries = items
    .map((post) => {
      const date = (post.publishedAt ?? post.fetchedAt ?? new Date()).toUTCString();
      const link = post.url || `${origin}/#post-${post.id}`;
      return `    <item>
      <title>${escapeXml(post.title || "Без заголовка")}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(`${post.sourceId}:${post.externalId}`)}</guid>
      <pubDate>${date}</pubDate>
      <source>${escapeXml(post.sourceTitle)}</source>
      <description><![CDATA[${(post.html || post.text).replaceAll("]]>", "]]&gt;")}]]></description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Единое хранилище постов</title>
    <link>${escapeXml(origin)}</link>
    <description>RSS + Telegram в одной ленте</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
