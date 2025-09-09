import { api } from "@/convex/_generated/api";
import { currentUser } from "@clerk/nextjs/server";
import { JsonToSseTransformStream, createUIMessageStream, convertToModelMessages, streamText, wrapLanguageModel, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { env } from "~/env";
import {
  buildProviderOptions,
  cleanMessagesForTools,
  combineTextFromUIMessages,
  isGoogleModel,
  isOpenAIProvider,
  isOpenAIReasoningModel,
  removeEmptyModelMessages,
} from "../chat/utils";
import { createGateway as createVercelGateway } from "@ai-sdk/gateway";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { overlayPointsTool, setCameraTool, setRotationTool, overlayBarsTool, setShaderParamsTool, overlayGeoTool, setBaseMapTool, clearOverlaysTool, overlayCountryMetricTool, fetchPopulationTool } from "./tools";

const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

export const maxDuration = 60;
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChatRequest = {
  messages: import("ai").UIMessage[];
  model: string;
  system?: string;
  temperature?: number;
  config?: {
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    openai?: {
      reasoningEffort?: "minimal" | "low" | "medium" | "high";
      reasoningSummary?: "auto" | "detailed";
      textVerbosity?: "low" | "medium" | "high";
      serviceTier?: "auto" | "flex" | "priority";
      parallelToolCalls?: boolean;
      store?: boolean;
      strictJsonSchema?: boolean;
      maxCompletionTokens?: number;
      user?: string;
      metadata?: Record<string, string>;
    };
    google?: {
      cachedContent?: string;
      structuredOutputs?: boolean;
      safetySettings?: Array<{ category: string; threshold: string }>;
      responseModalities?: string[];
      thinkingConfig?: { thinkingBudget?: number; includeThoughts?: boolean };
    };
    anthropic?: {
      thinkingBudget?: number;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      topK?: number;
    };
  };
  userApiKeys?: Record<string, string | undefined>;
  gateway?: string; // "llm-gateway" | "vercel-ai-gateway"
};

export async function POST(req: Request) {
  let modelToUse = "openai/gpt-4o";
  try {
    const body = await req.json();
    const { messages, model, system, temperature, config, userApiKeys = {}, gateway }: ChatRequest = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0 || !model) {
      return new Response(
        JSON.stringify({ error: "Messages (array) and model are required", receivedMessages: messages }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const normalizedGateway = (() => {
      if (typeof gateway === "string" && gateway.trim()) {
        const g = gateway.trim().toLowerCase();
        if (["llm-gateway", "llm", "llmgateway", "gateway-llm"].includes(g)) return "llm-gateway" as const;
        if (["vercel-ai-gateway", "vercel", "ai-gateway", "vercel-ai", "vercelaigateway"].includes(g)) return "vercel-ai-gateway" as const;
        return "unsupported" as const;
      }
      return "llm-gateway" as const;
    })();

    if (normalizedGateway === "unsupported") {
      return new Response(
        JSON.stringify({ error: "Unsupported gateway. Use 'llm-gateway' or 'vercel-ai-gateway'", code: "GATEWAY_NOT_SUPPORTED", usedGateway: "unsupported" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const usedGateway = normalizedGateway;

    // Resolve API keys (BYOK)
    let llmGatewayKey = userApiKeys?.llmGatewayApiKey as string | undefined;
    let aiGatewayKey = userApiKeys?.aiGatewayApiKey as string | undefined;

    if (!llmGatewayKey || !aiGatewayKey) {
      try {
        const user = await currentUser();
        if (user?.id) {
          const convexKeys = await convex.action(api.userKeys.getUserKeysForAPI, { userId: user.id });
          if (!llmGatewayKey && convexKeys?.llmGatewayApiKey) llmGatewayKey = convexKeys.llmGatewayApiKey as string;
          if (!aiGatewayKey && convexKeys?.aiGatewayApiKey) aiGatewayKey = convexKeys.aiGatewayApiKey as string;
        }
      } catch {}
    }
    if (!llmGatewayKey || !aiGatewayKey) {
      try {
        const raw = req.headers.get("x-local-keys");
        if (raw) {
          const headerKeys = JSON.parse(raw) as Record<string, string | undefined>;
          if (!llmGatewayKey && headerKeys?.llmGatewayApiKey) llmGatewayKey = headerKeys.llmGatewayApiKey;
          if (!aiGatewayKey && headerKeys?.aiGatewayApiKey) aiGatewayKey = headerKeys.aiGatewayApiKey;
        }
      } catch {}
    }

    // Validate keys for selected gateway
    if (usedGateway === "llm-gateway" && !llmGatewayKey) {
      const headers = new Headers({ "Content-Type": "application/json", "X-Used-Gateway": usedGateway });
      return new Response(
        JSON.stringify({ error: "No LLM Gateway API key configured.", code: "NO_API_KEY", usedGateway }),
        { status: 401, headers }
      );
    }
    if (usedGateway === "vercel-ai-gateway" && !aiGatewayKey) {
      const headers = new Headers({ "Content-Type": "application/json", "X-Used-Gateway": usedGateway });
      return new Response(
        JSON.stringify({ error: "No Vercel AI Gateway API key configured.", code: "NO_API_KEY", usedGateway }),
        { status: 401, headers }
      );
    }

    // Instantiate gateway providers
    const vercelGatewayProvider = createVercelGateway({
      apiKey: aiGatewayKey,
    });
    const llmGatewayProvider = createLLMGateway({
      apiKey: llmGatewayKey,
      compatibility: "strict",
    });

    const providerFor = (modelId: string) =>
      usedGateway === "vercel-ai-gateway" ? vercelGatewayProvider(modelId) : llmGatewayProvider(modelId);

    // Convert messages; enable tools by keeping tool parts
    // Normalize legacy message shape { role, content } into UIMessage parts shape for v5
    const normalizedUiMessages = (Array.isArray(messages) ? messages : []).map((m) => {
      const anyM = m as { id?: string; role?: string; content?: string; parts?: unknown[] };
      const hasParts = Array.isArray(anyM?.parts);
      if (hasParts) return anyM as import('ai').UIMessage;
      const content = typeof anyM?.content === 'string' ? anyM.content : '';
      return {
        id: anyM?.id || '',
        role: anyM?.role || 'user',
        parts: [{ type: 'text', text: content }],
      } as import('ai').UIMessage;
    });

    const sanitizedUiMessages = cleanMessagesForTools(normalizedUiMessages, true);
    const convertedMessages = convertToModelMessages(sanitizedUiMessages) as ModelMessage[];

    // Google image-preview models need text content not parts; keeping same logic as chat route
    const isGoogle = isGoogleModel(model);
    modelToUse = model || "openai/gpt-4o";
    const isOAIReasoning = isOpenAIReasoningModel(modelToUse);
    const isOpenAI = isOpenAIProvider(modelToUse);

    const modelImpl = providerFor(modelToUse);

    // Default system for world-analysis agent if caller did not provide one
    const WORLD_ANALYSIS_SYSTEM = (
      system && typeof system === 'string' && system.trim().length > 0
        ? system
        : [
            'You are a world-analysis visualization agent. Always prefer using tools over text to control the 3D Earth scene.',
            '- To highlight/show specific countries or regions, call overlayGeo with countryNames or countryCodes. If the user says "show X" or "only X", set style.maskOthers=true and choose a contrasting plainColor.',
            '- When focusing on a location or region, pause rotation via setRotation(running:false) and then setCamera to the target lat/lon.',
            '- To adjust sun/atmosphere, use setShaderParams.',
            '- To draw numeric data, use overlayPoints or overlayBars with labels and legend.',
            '- To switch the base map: day/night/paleo/custom URL, call setBaseMap. For queries like "earth map before continental drift", use setBaseMap(mode:"paleo").',
            '- If a new, unrelated question starts (not a follow-up), first call clearOverlays to reset the scene. For follow-ups, keep previous overlays unless the user asks to replace them.',
            '- After highlighting a country or region (overlayGeo), center the camera on it using setCamera with its approximate centroid. For country queries, you can use known centroids for CA (56,-96), IN (21,79), US (40,-100), etc.',
            '- Prefer vivid, high-contrast colors for fills and bars (e.g., #10B981, #F59E0B, #EF4444) to ensure readability over oceans and land.',
            '- When asked for metrics for all countries (e.g., population), either return overlayBars with lat/lon for each centroid, or use overlayCountryMetric with ISO codes and values so the client can place bars.',
            'You may use multiple tools in sequence until the visualization matches the request. Keep text minimal; rely on tools.'
          ].join('\n')
    );

    try {
      const result = await streamText({
        model: modelImpl,
        ...(isGoogle
          ? (() => {
              const prompt = combineTextFromUIMessages(messages as import("ai").UIMessage[]);
              const googleMessages = [
                { role: "user" as const, content: prompt && prompt.length > 0 ? prompt : "" },
              ];
              return { system: WORLD_ANALYSIS_SYSTEM, messages: googleMessages };
            })()
          : {
              system: WORLD_ANALYSIS_SYSTEM,
              messages: removeEmptyModelMessages<ModelMessage>(convertedMessages),
            }),
        ...(isOAIReasoning
          ? {}
          : {
              temperature,
              maxOutputTokens: config?.maxOutputTokens,
              topP: config?.topP,
              topK: typeof config?.topK === "number" && config.topK > 0 ? config.topK : undefined,
              ...(isOpenAI
                ? { frequencyPenalty: config?.frequencyPenalty, presencePenalty: config?.presencePenalty }
                : {}),
            }),
        tools: {
          overlayPoints: overlayPointsTool,
          overlayBars: overlayBarsTool,
          setCamera: setCameraTool,
          setRotation: setRotationTool,
          setShaderParams: setShaderParamsTool,
          overlayGeo: overlayGeoTool,
          setBaseMap: setBaseMapTool,
          clearOverlays: clearOverlaysTool,
          overlayCountryMetric: overlayCountryMetricTool,
          fetchPopulation: fetchPopulationTool,
        },
        // Enable multi-step tool use so the model can chain overlayGeo + setCamera + setRotation, etc.
        stopWhen: stepCountIs(6),
        toolChoice: "auto",
        providerOptions: {
          ...buildProviderOptions({
            modelId: modelToUse,
            isOAIReasoning,
            openai: config?.openai,
            google: config?.google,
            anthropic: config?.anthropic,
            maxOutputTokens: config?.maxOutputTokens,
            system,
          }),
          ...(isGoogle && /image-preview/i.test(modelToUse)
            ? { google: { ...config?.google, responseModalities: ["TEXT", "IMAGE"] } }
            : undefined),
        },
      });

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          result.consumeStream();
          writer.merge(result.toUIMessageStream({ sendReasoning: true }));
        },
      });

      const headers = new Headers({ "X-Used-Gateway": usedGateway, "Cache-Control": "no-store" });
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()), { headers });
    } catch (streamErr: unknown) {
      const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
      const responseBody: string | undefined = (streamErr as { responseBody?: string })?.responseBody;
      const lowerMsg = (errMsg || "").toLowerCase();
      const lowerBody = (responseBody || "").toLowerCase();
      const indicatesNoStreaming =
        lowerMsg.includes("does not support streaming") ||
        lowerMsg.includes("not support streaming") ||
        lowerMsg.includes("streaming is not supported") ||
        lowerBody.includes("does not support streaming") ||
        lowerBody.includes("not support streaming") ||
        lowerBody.includes("streaming is not supported");

      if (indicatesNoStreaming) {
        const simulated = wrapLanguageModel({
          model: providerFor(modelToUse),
          middleware: []
        });
        const result = await streamText({
          model: simulated,
          ...(isGoogle
            ? (() => {
                const prompt = combineTextFromUIMessages(messages as import("ai").UIMessage[]);
                const googleMessages = [
                  { role: "user" as const, content: prompt && prompt.length > 0 ? prompt : "" },
                ];
                return { system: WORLD_ANALYSIS_SYSTEM, messages: googleMessages };
              })()
            : { system: WORLD_ANALYSIS_SYSTEM, messages: removeEmptyModelMessages<ModelMessage>(convertedMessages) }),
          ...(isOAIReasoning ? {} : { temperature }),
          ...(isOAIReasoning ? {} : { maxOutputTokens: config?.maxOutputTokens }),
          ...(isOAIReasoning ? {} : { topP: config?.topP }),
          ...(isOAIReasoning
            ? {}
            : isOpenAI
              ? { frequencyPenalty: config?.frequencyPenalty, presencePenalty: config?.presencePenalty }
              : {}),
          tools: {
          overlayPoints: overlayPointsTool,
          overlayBars: overlayBarsTool,
          setCamera: setCameraTool,
          setRotation: setRotationTool,
          setShaderParams: setShaderParamsTool,
          overlayGeo: overlayGeoTool,
          setBaseMap: setBaseMapTool,
          clearOverlays: clearOverlaysTool,
          overlayCountryMetric: overlayCountryMetricTool,
          fetchPopulation: fetchPopulationTool,
        },
          stopWhen: stepCountIs(6),
          toolChoice: "auto",
          providerOptions: buildProviderOptions({
            modelId: modelToUse,
            isOAIReasoning,
            openai: config?.openai,
            google: config?.google,
            anthropic: config?.anthropic,
            maxOutputTokens: config?.maxOutputTokens,
            system,
          }),
        });

        const stream = createUIMessageStream({
          execute: ({ writer }) => {
            result.consumeStream();
            writer.merge(result.toUIMessageStream({ sendReasoning: true }));
          },
        });
        const headers = new Headers({ "X-Used-Gateway": usedGateway, "Cache-Control": "no-store" });
        return new Response(stream.pipeThrough(new JsonToSseTransformStream()), { headers });
      }

      throw streamErr;
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const headers = new Headers({ "Content-Type": "application/json", "X-Used-Gateway": "unknown", "Cache-Control": "no-store" });
    return new Response(JSON.stringify({ error: "Internal server error", details: errorMessage }), { status: 500, headers });
  }
}
