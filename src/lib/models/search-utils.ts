import type { ModelConfig } from "./types";

export function getSearchCapabilities(model: ModelConfig, userKeys: Record<string, string | undefined>) {
  const providerId = model.providerId;
  
  // Native search support (built into AI SDK)
  const hasNativeSearch = 
    providerId === "openai" ||
    providerId === "google" ||
    providerId === "perplexity";
  
  // Tool-based search support (requires API keys)
  const hasExaSearch = Boolean(userKeys.exaKey);
  const hasFirecrawlSearch = Boolean(userKeys.firecrawlKey);
  const hasToolSearch = hasExaSearch || hasFirecrawlSearch;
  
  const supportsSearch = hasNativeSearch || hasToolSearch;
  
  return {
    supportsSearch,
    hasNativeSearch,
    hasToolSearch,
    hasExaSearch,
    hasFirecrawlSearch,
    searchMethods: {
      ...(providerId === "openai" && { openai: "OpenAI Web Search" }),
      ...(providerId === "google" && { google: "Google Search Grounding" }),
      ...(providerId === "perplexity" && { perplexity: "Perplexity Sonar" }),
      ...(hasExaSearch && { exa: "Exa AI Search" }),
      ...(hasFirecrawlSearch && { firecrawl: "Firecrawl Web Crawling" }),
    }
  };
}

export function shouldShowSearchToggle(model: ModelConfig, userKeys: Record<string, string | undefined>): boolean {
  const { supportsSearch } = getSearchCapabilities(model, userKeys);
  return supportsSearch;
}
