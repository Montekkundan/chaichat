import { api } from "@/convex/_generated/api";
import { currentUser } from "@clerk/nextjs/server";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import {
  JsonToSseTransformStream,
  type UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  simulateStreamingMiddleware,
  streamText,
  wrapLanguageModel,
  type JSONValue,
} from "ai";
import { ConvexHttpClient } from "convex/browser";
import { env } from "~/env";
import type { LLMGatewayModel } from "~/types/llmgateway";

const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

// todo make simpler
export const maxDuration = 60;

let llmGatewayModelsCache: {
  data: LLMGatewayModel[];
  timestamp: number;
} | null = null;

async function getLLMGatewayModels(): Promise<LLMGatewayModel[]> {
  const now = Date.now();
  if (
    llmGatewayModelsCache &&
    now - llmGatewayModelsCache.timestamp < 5 * 60 * 1000
  ) {
    return llmGatewayModelsCache.data;
  }
  try {
    const res = await fetch("https://api.llmgateway.io/v1/models", {
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: LLMGatewayModel[] };
    const models = Array.isArray(json.data) ? json.data : [];
    llmGatewayModelsCache = { data: models, timestamp: now };
    return models;
  } catch {
    return [];
  }
}

function parseProviderAndModel(modelId: string): {
  providerId?: string;
  modelName: string;
} {
  if (!modelId.includes("/")) {
    return { modelName: modelId };
  }
  const firstSlash = modelId.indexOf("/");
  const providerId = modelId.slice(0, firstSlash);
  const modelName = modelId.slice(firstSlash + 1);
  return { providerId, modelName };
}

async function isStreamingSupportedByProviderModel(
  modelId: string
): Promise<boolean | undefined> {
  const models = await getLLMGatewayModels();
  const { providerId, modelName } = parseProviderAndModel(modelId);

  const match = models.find(
    (m) =>
      m?.id === modelName ||
      m?.name === modelName ||
      m?.id === modelId ||
      m?.name === modelId
  );
  if (!match) return undefined;
  const providers = Array.isArray(match?.providers) ? match.providers : [];
  if (providerId) {
    const p = providers.find(
      (prov) =>
        prov?.providerId === providerId &&
        (prov?.modelName === modelName || prov?.modelName === modelId)
    );
    if (p && typeof p.streaming === "boolean") return p.streaming;
    return undefined;
  }
  const anyStreaming = providers.some((prov) => prov?.streaming === true);
  const allFalse = providers.every((prov) => prov?.streaming === false);
  if (anyStreaming) return true;
  if (allFalse) return false;
  return undefined;
}

function requiresDefaultTemperatureOne(modelId: string): boolean {
  const { providerId, modelName } = parseProviderAndModel(modelId);
  if (
    (providerId === "openai" || !providerId) &&
    typeof modelName === "string"
  ) {
    return modelName === "o3" || modelName.startsWith("o3-");
  }
  return false;
}

function normalizeTemperatureForModel(
  modelId: string,
  requested: number | undefined
): number | undefined {
  if (requiresDefaultTemperatureOne(modelId)) {
    return 1;
  }
  return requested;
}

function isOpenAIReasoningModel(modelId: string): boolean {
  const { providerId, modelName } = parseProviderAndModel(modelId);
  if (providerId && providerId !== "openai") return false;
  if (!modelName) return false;
  return (
    modelName === "o1" ||
    modelName.startsWith("o1-") ||
    modelName === "o3" ||
    modelName.startsWith("o3-") ||
    modelName === "o4-mini" ||
    modelName.startsWith("o4-mini-")
  );
}

type ChatRequest = {
  messages: UIMessage[];
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
  };
  userApiKeys?: Record<string, string | undefined>;
};

export async function POST(req: Request) {
  let modelToUse = "openai/gpt-4o";

  try {
    const body = await req.json();

    const {
      messages,
      model,
      system,
      temperature = 0.7,
      config,
      userApiKeys = {},
    }: ChatRequest = body;

    if (!messages?.length || !model) {
      return new Response(
        JSON.stringify({ error: "Messages and model are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const convertedMessages = convertToModelMessages(messages);

    modelToUse = model || "openai/gpt-4o";

    let apiKey: string | undefined;

    if (userApiKeys?.llmGatewayApiKey) {
      apiKey = userApiKeys.llmGatewayApiKey;
    } else {
      try {
        const user = await currentUser();
        if (user?.id) {
          const convexKeys = await convex.action(
            api.userKeys.getUserKeysForAPI,
            {
              userId: user.id,
            }
          );
          if (convexKeys?.llmGatewayApiKey) {
            apiKey = convexKeys.llmGatewayApiKey;
          }
        }
      } catch (error) {
        console.warn("Failed to get user API key from Convex:", error);
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "No LLM Gateway API key configured. Please add your API key in settings.",
          code: "NO_API_KEY",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const llmGatewayProvider = createLLMGateway({
      apiKey: apiKey,
      compatibility: "strict",
    });

    let shouldUseSimulatedStreaming = false;
    try {
      const supportsStreaming =
        await isStreamingSupportedByProviderModel(modelToUse);
      if (supportsStreaming === false) {
        shouldUseSimulatedStreaming = true;
      }
    } catch {}

    try {
      const baseModel = llmGatewayProvider(modelToUse);
      // No <think> extraction: handle responses as-is per DeepSeek v5 docs and unified reasoning
      const modelForRequest = shouldUseSimulatedStreaming
        ? wrapLanguageModel({
            model: baseModel,
            middleware: simulateStreamingMiddleware(),
          })
        : baseModel;

      const effectiveTemperature = normalizeTemperatureForModel(
        modelToUse,
        temperature
      );

      const isOAIReasoning = isOpenAIReasoningModel(modelToUse);
      const result = await streamText({
        model: modelForRequest,
        system,
        messages: convertedMessages,
        temperature: effectiveTemperature,
        ...(isOAIReasoning ? {} : { maxOutputTokens: config?.maxOutputTokens }),
        topP: config?.topP,
        topK: config?.topK,
        frequencyPenalty: config?.frequencyPenalty,
        presencePenalty: config?.presencePenalty,
         providerOptions: (():
           | Record<string, Record<string, JSONValue>>
           | undefined => {
          const { providerId } = parseProviderAndModel(modelToUse);
          const rootProvider = providerId || modelToUse.split("/")[0];
          const options: Record<string, Record<string, JSONValue>> = {};
          if (/openai/i.test(rootProvider ?? "") && config?.openai) {
             const {
               reasoningEffort,
               reasoningSummary,
               textVerbosity,
               serviceTier,
               parallelToolCalls,
               store,
               strictJsonSchema,
               maxCompletionTokens,
               user,
               metadata,
             } = config.openai;
            const openaiOpts: Record<string, JSONValue> = {};
            const mc = isOAIReasoning
              ? (maxCompletionTokens ?? config?.maxOutputTokens)
              : maxCompletionTokens;
            if (typeof mc === "number") openaiOpts.maxCompletionTokens = mc;
            if (typeof reasoningEffort === "string") openaiOpts.reasoningEffort = reasoningEffort as JSONValue;
            if (typeof reasoningSummary === "string") openaiOpts.reasoningSummary = reasoningSummary as JSONValue;
            if (typeof textVerbosity === "string") openaiOpts.textVerbosity = textVerbosity as JSONValue;
            if (typeof serviceTier === "string") openaiOpts.serviceTier = serviceTier as JSONValue;
            if (typeof parallelToolCalls === "boolean") openaiOpts.parallelToolCalls = parallelToolCalls;
            if (typeof store === "boolean") openaiOpts.store = store;
            if (typeof strictJsonSchema === "boolean") openaiOpts.strictJsonSchema = strictJsonSchema;
            if (typeof user === "string" && user.length > 0) openaiOpts.user = user;
            if (metadata && Object.keys(metadata).length > 0) openaiOpts.metadata = metadata as unknown as JSONValue;
            if (Object.keys(openaiOpts).length > 0) options.openai = openaiOpts;
          }
          if (/^(google|gemini)$/i.test(rootProvider ?? "") && config?.google) {
             const {
               cachedContent,
               structuredOutputs,
               safetySettings,
               responseModalities,
               thinkingConfig,
             } = config.google;
            const googleOpts: Record<string, JSONValue> = {};
            if (typeof cachedContent === "string" && cachedContent.length > 0)
              googleOpts.cachedContent = cachedContent;
            if (typeof structuredOutputs === "boolean")
              googleOpts.structuredOutputs = structuredOutputs;
            if (Array.isArray(safetySettings) && safetySettings.length > 0)
              googleOpts.safetySettings = safetySettings as unknown as JSONValue;
            if (Array.isArray(responseModalities) && responseModalities.length > 0)
              googleOpts.responseModalities = responseModalities as unknown as JSONValue;
            if (thinkingConfig && (typeof thinkingConfig.thinkingBudget === "number" || typeof thinkingConfig.includeThoughts === "boolean"))
              googleOpts.thinkingConfig = thinkingConfig as unknown as JSONValue;
            if (Object.keys(googleOpts).length > 0) options.google = googleOpts;
           }
           return Object.keys(options).length ? options : undefined;
        })(),
      });

      const stream = createUIMessageStream({
        execute: ({ writer }) => {
          result.consumeStream();
          writer.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            })
          );
        },
      });

    //   return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
	return result.toUIMessageStreamResponse({
		sendReasoning: true,
	  });
    } catch (streamErr: unknown) {
      const errMsg =
        streamErr instanceof Error ? streamErr.message : String(streamErr);
      // biome-ignore lint/suspicious/noExplicitAny: inspecting provider error shape
      const responseBody: string | undefined = (streamErr as any)?.responseBody;
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
        const simulatedStreamingModel = wrapLanguageModel({
          model: llmGatewayProvider(modelToUse),
          middleware: simulateStreamingMiddleware(),
        });

        const effectiveTemperature = normalizeTemperatureForModel(
          modelToUse,
          temperature
        );
        const isOAIReasoning2 = isOpenAIReasoningModel(modelToUse);
        const result = await streamText({
          model: simulatedStreamingModel,
          system,
          messages: convertedMessages,
          temperature: effectiveTemperature,
          ...(isOAIReasoning2 ? {} : { maxOutputTokens: config?.maxOutputTokens }),
          topP: config?.topP,
          topK: config?.topK,
          frequencyPenalty: config?.frequencyPenalty,
          presencePenalty: config?.presencePenalty,
           providerOptions: (():
             | Record<string, Record<string, JSONValue>>
             | undefined => {
            const { providerId } = parseProviderAndModel(modelToUse);
            const rootProvider = providerId || modelToUse.split("/")[0];
            const options: Record<string, Record<string, JSONValue>> = {};
            if (/openai/i.test(rootProvider ?? "") && config?.openai) {
               const {
                 reasoningEffort,
                 reasoningSummary,
                 textVerbosity,
                 serviceTier,
                 parallelToolCalls,
                 store,
                 strictJsonSchema,
                 maxCompletionTokens,
                 user,
                 metadata,
               } = config.openai;
              const openaiOpts2: Record<string, JSONValue> = {};
              const mc2 = isOAIReasoning2
                ? (maxCompletionTokens ?? config?.maxOutputTokens)
                : maxCompletionTokens;
              if (typeof mc2 === "number") openaiOpts2.maxCompletionTokens = mc2;
              if (typeof reasoningEffort === "string") openaiOpts2.reasoningEffort = reasoningEffort as JSONValue;
              if (typeof reasoningSummary === "string") openaiOpts2.reasoningSummary = reasoningSummary as JSONValue;
              if (typeof textVerbosity === "string") openaiOpts2.textVerbosity = textVerbosity as JSONValue;
              if (typeof serviceTier === "string") openaiOpts2.serviceTier = serviceTier as JSONValue;
              if (typeof parallelToolCalls === "boolean") openaiOpts2.parallelToolCalls = parallelToolCalls;
              if (typeof store === "boolean") openaiOpts2.store = store;
              if (typeof strictJsonSchema === "boolean") openaiOpts2.strictJsonSchema = strictJsonSchema;
              if (typeof user === "string" && user.length > 0) openaiOpts2.user = user;
              if (metadata && Object.keys(metadata).length > 0) openaiOpts2.metadata = metadata as unknown as JSONValue;
              if (Object.keys(openaiOpts2).length > 0) options.openai = openaiOpts2;
            }
            if (/^(google|gemini)$/i.test(rootProvider ?? "") && config?.google) {
               const {
                 cachedContent,
                 structuredOutputs,
                 safetySettings,
                 responseModalities,
                 thinkingConfig,
               } = config.google;
              const googleOpts2: Record<string, JSONValue> = {};
              if (typeof cachedContent === "string" && cachedContent.length > 0)
                googleOpts2.cachedContent = cachedContent;
              if (typeof structuredOutputs === "boolean")
                googleOpts2.structuredOutputs = structuredOutputs;
              if (Array.isArray(safetySettings) && safetySettings.length > 0)
                googleOpts2.safetySettings = safetySettings as unknown as JSONValue;
              if (Array.isArray(responseModalities) && responseModalities.length > 0)
                googleOpts2.responseModalities = responseModalities as unknown as JSONValue;
              if (thinkingConfig && (typeof thinkingConfig.thinkingBudget === "number" || typeof thinkingConfig.includeThoughts === "boolean"))
                googleOpts2.thinkingConfig = thinkingConfig as unknown as JSONValue;
              if (Object.keys(googleOpts2).length > 0) options.google = googleOpts2;
             }
             return Object.keys(options).length ? options : undefined;
          })(),
        });

        const stream = createUIMessageStream({
          execute: ({ writer }) => {
            result.consumeStream();
            writer.merge(
              result.toUIMessageStream({
                sendReasoning: true,
              })
            );
          },
        });

        return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
      }

      throw streamErr;
    }
  } catch (err: unknown) {
    console.error("Chat API error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";

    if (
      errorMessage.includes("not supported") ||
      errorMessage.includes("Bad Request")
    ) {
      return new Response(
        JSON.stringify({
          error: `Model "${modelToUse}" is not supported by the LLM Gateway. Please select a different model.`,
          code: "MODEL_NOT_SUPPORTED",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please wait a moment and try again.",
          code: "RATE_LIMITED",
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    if (
      errorMessage.includes("quota") ||
      errorMessage.includes("insufficient")
    ) {
      return new Response(
        JSON.stringify({
          error: "API quota exceeded. Please check your API key limits.",
          code: "QUOTA_EXCEEDED",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
