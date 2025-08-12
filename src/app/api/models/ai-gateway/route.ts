import type { NextRequest } from "next/server";
import { createGateway } from "@ai-sdk/gateway";

type AIGatewayModel = {
  id: string; // e.g. "openai/gpt-4o"
  name?: string;
  description?: string;
  pricing?: { prompt?: string; completion?: string };
};

type GatewayAvailableModels = {
  models: Array<{ id: string; name?: string; description?: string; pricing?: Record<string, unknown> }>;
};

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    const tokenMatch = authHeader?.match(/Bearer\s+(.+)/i);
    const apiKey = tokenMatch?.[1] || process.env.AI_GATEWAY_API_KEY || "";

    if (!apiKey) {
      return Response.json(
        { error: "Missing AI Gateway API key. Provide Authorization: Bearer <key> or set AI_GATEWAY_API_KEY." },
        { status: 401 },
      );
    }

    const gateway = createGateway({ apiKey });
    const data = (await gateway.getAvailableModels()) as unknown as GatewayAvailableModels;
    const rawModels = Array.isArray(data.models) ? data.models : [];

    const mapped = rawModels.map((m) => {
      const id: string = m.id || m.name || "";
      const name: string = m.name || id?.split("/")?.[1] || id;
      const description: string | undefined = m.description;
      const pricing = (m as unknown as { pricing?: Record<string, unknown> }).pricing || {};
      return {
        id,
        name,
        description,
        pricing,
        providers: undefined,
        architecture: undefined,
        top_provider: undefined,
        json_output: undefined,
        deprecated_at: undefined,
        deactivated_at: undefined,
      } as unknown as AIGatewayModel;
    });

    return Response.json({ models: mapped });
  } catch (error) {
    console.error("Failed to fetch models from Vercel AI Gateway:", error);
    return Response.json({ error: "Failed to load models" }, { status: 500 });
  }
}


