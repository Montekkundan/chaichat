export type GatewayType = "llm-gateway" | "vercel-ai-gateway" | "unsupported";

export function normalizeGateway(input?: string, fallback: GatewayType = "llm-gateway"): GatewayType {
  if (typeof input !== "string" || input.trim().length === 0) return fallback;
  const g = input.trim().toLowerCase();
  if (g === "llm-gateway" || g === "llm" || g === "llmgateway" || g === "gateway-llm") return "llm-gateway";
  if (
    g === "vercel-ai-gateway" ||
    g === "vercel" ||
    g === "ai-gateway" ||
    g === "vercel-ai" ||
    g === "vercelaigateway"
  )
    return "vercel-ai-gateway";
  return "unsupported";
}

