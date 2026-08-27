import { ApiDocs } from "@/components/api-docs";
import { Dashboard } from "@/components/dashboard";
import { toPostDTO, toSourceDTO, type PostDTO, type SourceDTO, type Stats } from "@/lib/dto";
import { getStats, listPosts, listSources } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let sources: SourceDTO[] = [];
  let posts: PostDTO[] = [];
  let total = 0;
  let stats: Stats = { total: 0, rss: 0, telegram: 0, last24h: 0, unread: 0, starred: 0 };

  try {
    const [sourceRows, postPage, statsRow] = await Promise.all([
      listSources(),
      listPosts({ limit: 30 }),
      getStats(),
    ]);

    sources = sourceRows.map(toSourceDTO);
    posts = postPage.items.map(toPostDTO);
    total = postPage.total;
    stats = statsRow;
  } catch {
    // Таблицы ещё не созданы — покажем пустой дашборд.
  }

  return (
    <main>
      <Dashboard
        initialSources={sources}
        initialPosts={posts}
        initialTotal={total}
        initialStats={stats}
      />
      <ApiDocs />
    </main>
  );
}
