import { tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";
// Minimal Firecrawl client and types (scoped to this tool)
type FirecrawlWebResult = { url: string; title: string; description: string; markdown: string; position: number };
type FirecrawlNewsResult = { title: string; url: string; snippet: string; date: string; position: number };
type FirecrawlImageResult = { title: string; imageUrl: string; imageWidth: number; imageHeight: number; url: string; position: number };

class FirecrawlClient {
  private apiKey: string;
  private baseUrl = "https://api.firecrawl.dev/v2";
  constructor(apiKey: string) { this.apiKey = apiKey; }
  async search(options: { query: string; sources?: ("web" | "news" | "images")[]; limit?: number; location?: string; tbs?: string; }): Promise<{ success: boolean; data: { web?: FirecrawlWebResult[]; news?: FirecrawlNewsResult[]; images?: FirecrawlImageResult[] } }> {
    const response = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        query: options.query,
        sources: options.sources || ["web"],
        limit: options.limit || 10,
        location: options.location,
        tbs: options.tbs,
        scrapeOptions: { formats: ["markdown"], proxy: "auto", blockAds: true },
      }),
    });
    if (!response.ok) { const errorText = await response.text(); throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`); }
    return response.json();
  }
}

type Topic = "general" | "news";
type Quality = "default" | "best";

const extractDomain = (url: string | null | undefined): string => {
  if (!url || typeof url !== "string") return "";
  const urlPattern = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i;
  return url.match(urlPattern)?.[1] || url;
};

const cleanTitle = (title: string): string => {
  return title
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const deduplicateByDomainAndUrl = <T extends { url: string }>(items: T[]): T[] => {
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  return items.filter((item) => {
    const domain = extractDomain(item.url);
    const isNewUrl = !seenUrls.has(item.url);
    const isNewDomain = !seenDomains.has(domain);

    if (isNewUrl && isNewDomain) {
      seenUrls.add(item.url);
      seenDomains.add(domain);
      return true;
    }
    return false;
  });
};

const processDomains = (domains?: (string | null)[]): string[] | undefined => {
  if (!domains || domains.length === 0) return undefined;
  const processed = domains.map((d) => extractDomain(d)).filter((d) => d.trim() !== "");
  return processed.length === 0 ? undefined : processed;
};

const augmentQueriesForRecency = (queries: string[], topics: Topic[]): string[] => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = now.toLocaleString("en-US", { month: "long" });
  const enriched: string[] = [];
  const cap = Math.min(queries.length, 5);
  for (let i = 0; i < cap; i++) {
    const q = queries[i] || "";
    const topic = (topics[i] || topics[0] || "general") as Topic;
    enriched.push(q);
    if (topic === "news") {
      // Add time hints for recency if not already present
      const qLower = q.toLowerCase();
      const hasYear = /\b20\d{2}\b/.test(qLower);
      if (!hasYear) enriched.push(`${q} ${year}`);
      if (!qLower.includes(month.toLowerCase())) enriched.push(`${q} ${month} ${year}`);
      enriched.push(`${q} today`);
      enriched.push(`${q} latest`);
    }
  }
  // Deduplicate and cap to 5 to respect tool schema
  const unique = Array.from(new Set(enriched.map((s) => s.trim()).filter(Boolean)));
  return unique.slice(0, 5);
};

export function makeWebSearchTool(params: {
  provider: "exa" | "firecrawl";
  exaApiKey?: string;
  firecrawlApiKey?: string;
}) {
  const { provider, exaApiKey, firecrawlApiKey } = params;

  return tool({
    description:
      "Search the web with multiple queries, topics, quality, and optional domain filters (Exa/Firecrawl).",
    inputSchema: z.object({
      queries: z
        .array(z.string())
        .min(1)
        .max(5)
        .describe("Array of 3-5 search queries. Use user's language."),
      maxResults: z
        .array(z.number())
        .min(1)
        .max(5)
        .describe("Max results per query. Default 10, min 8, max 15."),
      topics: z
        .array(z.enum(["general", "news"]))
        .min(1)
        .max(5)
        .describe("Topic per query: general or news."),
      quality: z
        .array(z.enum(["default", "best"]))
        .min(1)
        .max(5)
        .describe("Quality per query. Avoid 'best' unless necessary."),
      include_domains: z.array(z.string()).optional(),
      exclude_domains: z.array(z.string()).optional(),
    }),
    execute: async ({
      queries,
      maxResults,
      topics,
      quality,
      include_domains,
      exclude_domains,
    }: {
      queries: string[];
      maxResults: number[];
      topics: Topic[];
      quality: Quality[];
      include_domains?: string[];
      exclude_domains?: string[];
    }) => {
      const queriesToRun = augmentQueriesForRecency(queries, topics);

      if (provider === "exa") {
        if (!exaApiKey) throw new Error("Missing Exa API key");
        const exa = new Exa(exaApiKey);

        const processedInclude = processDomains(include_domains);
        const processedExclude = processDomains(exclude_domains);

        const searches = await Promise.all(
          queriesToRun.map(async (query, index) => {
            const topic = topics[index] || topics[0] || "general";
            const maxRes = Math.max(maxResults[index] || maxResults[0] || 10, 8);
            const qual = quality[index] || quality[0] || "default";

            type ExaOptions = {
              text?: true;
              type?: "auto" | "hybrid" | "keyword" | "neural" | "fast";
              numResults?: number;
              livecrawl?: "preferred" | "always";
              useAutoprompt?: boolean;
              category?: "news";
              includeDomains?: string[];
              excludeDomains?: string[];
              startPublishedDate?: string;
            };
            const searchOptions: ExaOptions = {
              text: true,
              type: qual === "best" ? "hybrid" : "auto",
              numResults: maxRes,
              livecrawl: topic === "news" ? "always" : "preferred",
              useAutoprompt: true,
              category: topic === "news" ? "news" : undefined,
            };

            // Bias Exa results toward recent news (past 7 days) when topic=news
            if (topic === "news") {
              const d = new Date();
              d.setDate(d.getDate() - 7);
              // YYYY-MM-DD
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const day = String(d.getDate()).padStart(2, "0");
              searchOptions.startPublishedDate = `${y}-${m}-${day}`;
            }

            const hasInclude = Array.isArray(processedInclude) && processedInclude.length > 0;
            const hasExclude = Array.isArray(processedExclude) && processedExclude.length > 0;
            if (hasInclude && hasExclude) {
              searchOptions.includeDomains = processedInclude;
            } else if (hasInclude) {
              searchOptions.includeDomains = processedInclude;
            } else if (hasExclude) {
              searchOptions.excludeDomains = processedExclude;
            }

            const data = await exa.searchAndContents(query, searchOptions);

            const collectedImages: { url: string; description: string }[] = [];
            type ExaResult = {
              url: string;
              title: string | null;
              text?: string | null;
              image?: string | null;
              publishedDate?: string;
              author?: string | null;
            };
            const results = ((data as unknown as { results?: ExaResult[] }).results || []).map((result) => {
              if (result.image) {
                collectedImages.push({
                  url: result.image,
                  description: cleanTitle(result.title || `${result.text?.substring(0, 100)}...` || ""),
                });
              }
              return {
                url: result.url,
                title: cleanTitle(result.title || ""),
                content: (result.text || "").substring(0, 1000),
                published_date: topic === "news" && result.publishedDate ? result.publishedDate : undefined,
                author: result.author || undefined,
              };
            });

            return {
              query,
              results: deduplicateByDomainAndUrl(results),
              images: deduplicateByDomainAndUrl(collectedImages),
            };
          })
        );

        return { searches };
      }

      // provider === "firecrawl"
      if (!firecrawlApiKey) throw new Error("Missing Firecrawl API key");
      const firecrawl = new FirecrawlClient(firecrawlApiKey);

      const searches = await Promise.all(
        queriesToRun.map(async (query, index) => {
          const topic = topics[index] || topics[0] || "general";
          const maxRes = Math.max(maxResults[index] || maxResults[0] || 10, 8);

          const sources: ("web" | "news" | "images")[] = [];
          if (topic === "news") sources.push("news", "web");
          else sources.push("web");
          sources.push("images");

          const resp = await firecrawl.search({ query, sources, limit: maxRes, tbs: topic === "news" ? "qdr:d" : undefined });

          let results: Array<{
            url: string;
            title: string;
            content: string;
            published_date?: string;
            author?: string;
          }> = [];
          let images: { url: string; description: string }[] = [];

          if (resp.success && resp.data?.web) {
            results = deduplicateByDomainAndUrl((resp.data.web || []) as FirecrawlWebResult[]).map((r) => ({
              url: r.url,
              title: cleanTitle(r.title || ""),
              content: r.markdown?.slice(0, 2000) || r.description || "",
              published_date: undefined,
              author: undefined,
            }));
          }

          if (resp.success && resp.data?.news && topic === "news") {
            const newsResults = deduplicateByDomainAndUrl((resp.data.news || []) as FirecrawlNewsResult[]).map((r) => ({
              url: r.url,
              title: cleanTitle(r.title || ""),
              content: r.snippet || "",
              published_date: r.date || undefined,
              author: undefined,
            }));
            results = [...newsResults, ...results];
          }

          if (resp.success && resp.data?.images) {
            images = deduplicateByDomainAndUrl((resp.data.images || []) as FirecrawlImageResult[]).map((img) => ({
              url: img.imageUrl,
              description: cleanTitle(img.title || ""),
            }));
          }

          return {
            query,
            results: deduplicateByDomainAndUrl(results),
            images: deduplicateByDomainAndUrl(images),
          };
        })
      );

      return { searches };
    },
  });
}


