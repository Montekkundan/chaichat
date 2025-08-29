import { api } from "@/convex/_generated/api";
import { currentUser } from "@clerk/nextjs/server";
import {
  JsonToSseTransformStream,
  type UIMessage,
  convertToModelMessages,
  createUIMessageStream,
  simulateStreamingMiddleware,
  streamText,
  wrapLanguageModel,
} from "ai";
import type { ModelMessage } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { env } from "~/env";
import { buildProviderOptions, isGoogleModel, isOpenAIReasoningModel, isOpenAIProvider, cleanMessagesForTools } from "./utils";
import { errorResponseForChat, isNoStreamingError } from "./error-utils";
import { normalizeGateway } from "./gateway-utils";
import { hasImageParts as _hasImageParts, inlineExternalMedia as _inlineExternalMedia } from "./message-utils";
import { buildPromptPayload } from "./prompt-builder";
import { makeProviders, getBaseModel } from "./provider-factory";
import { generateImagesViaGateway } from "./image-generation";

const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

// todo make simpler
export const maxDuration = 60;
// Run on the Edge to reduce cold start and improve streaming latency
export const runtime = "edge";
// Disable caching for chat streams
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    anthropic?: {
      thinkingBudget?: number;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      topK?: number;
    };
  };
  userApiKeys?: Record<string, string | undefined>;
  // Preferred: which gateway to use (e.g. "llm-gateway" | "vercel-ai-gateway")
  gateway?: string;
  imageGeneration?: {
    prompt: string;
    size?: string;
    model?: string;
    n?: number;
  };
};

// TODO: make this simpler

export async function POST(req: Request) {
  let modelToUse = "openai/gpt-4o";

  try {
    // Parse JSON request - files are already uploaded to UploadThing by frontend
    const body = await req.json();

    const {
      messages,
      model,
      system,
      temperature,
      config,
      userApiKeys = {},
      gateway,
      imageGeneration,
    }: ChatRequest = body;

    // Handle image generation requests (no messages required)
    if (imageGeneration && typeof imageGeneration === "object") {
      try {
        // Keys from header for anonymous users
        let headerKeys: Record<string, unknown> = {};
        try {
          const raw = req.headers.get("x-local-keys");
          if (raw) headerKeys = JSON.parse(raw);
        } catch {}

        let llmKey =
          userApiKeys?.llmGatewayApiKey ||
          (headerKeys?.llmGatewayApiKey as string | undefined);
        let aiKey =
          userApiKeys?.aiGatewayApiKey ||
          (headerKeys?.aiGatewayApiKey as string | undefined);
        if (!llmKey || !aiKey) {
          try {
            const user = await currentUser();
            if (user?.id) {
              const convexKeys = await convex.action(
                api.userKeys.getUserKeysForAPI,
                { userId: user.id }
              );
              if (!llmKey && convexKeys?.llmGatewayApiKey)
                llmKey = convexKeys.llmGatewayApiKey;
              if (!aiKey && convexKeys?.aiGatewayApiKey)
                aiKey = convexKeys.aiGatewayApiKey;
            }
          } catch {}
        }

        // Normalize gateway just for image generation flow
        const igUsedGatewayRaw = normalizeGateway(gateway, "llm-gateway");
        const igUsedGateway = (igUsedGatewayRaw === "unsupported"
          ? "llm-gateway"
          : igUsedGatewayRaw) as "llm-gateway" | "vercel-ai-gateway";

        if (igUsedGateway === "llm-gateway" && !llmKey) {
          return new Response(
            JSON.stringify({
              error: "No LLM Gateway API key configured.",
              code: "NO_API_KEY",
              usedGateway: igUsedGateway,
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        if (igUsedGateway === "vercel-ai-gateway" && !aiKey) {
          return new Response(
            JSON.stringify({
              error: "No Vercel AI Gateway API key configured.",
              code: "NO_API_KEY",
              usedGateway: igUsedGateway,
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }

        const requestedModel =
          (typeof imageGeneration.model === "string" &&
            imageGeneration.model) ||
          "openai/dall-e-3";
        const sizeRaw = imageGeneration.size || "1024x1024";
        const allowed = new Set(["256x256", "512x512", "1024x1024"]);
        const size = allowed.has(sizeRaw)
          ? (sizeRaw as "256x256" | "512x512" | "1024x1024")
          : "1024x1024";
        const prompt = imageGeneration.prompt || "";
        const n =
          typeof imageGeneration.n === "number" && imageGeneration.n > 0
            ? imageGeneration.n
            : 1;

        const images = await generateImagesViaGateway({
          usedGateway: igUsedGateway,
          modelId: requestedModel,
          prompt,
          size,
          n,
          llmKey: llmKey ?? undefined,
          aiKey: aiKey ?? undefined,
        });
        return new Response(JSON.stringify({ images }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
        });
      } catch (e) {
        return new Response(
          JSON.stringify({
            error: "Image generation failed",
            details: e instanceof Error ? e.message : String(e),
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Determine which gateway to use (string parameter only)
    const normalizedGatewayRaw = normalizeGateway(gateway, "llm-gateway");

    if (normalizedGatewayRaw === "unsupported") {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Used-Gateway": "unsupported",
      });
      return new Response(
        JSON.stringify({
          error:
            "Unsupported gateway specified. Supported values: 'llm-gateway', 'vercel-ai-gateway'.",
          code: "GATEWAY_NOT_SUPPORTED",
          usedGateway: "unsupported",
        }),
        { status: 400, headers }
      );
    }

    const usedGateway = normalizedGatewayRaw as "llm-gateway" | "vercel-ai-gateway";

    console.log("API Route - Received gateway:", gateway);
    console.log("API Route - Normalized gateway:", usedGateway);
    console.log(
      "API Route - Messages:",
      messages?.map((m) => ({
        role: m.role,
        partsCount: m.parts?.length || 0,
        parts: m.parts?.map((p) => ({
          type: p.type,
          content:
            p.type === "text"
              ? `${p.text?.substring(0, 50)}...`
              : "image" in p
                ? "IMAGE"
                : p.type,
        })),
      }))
    );

    // Declare API key variables at the top level
    let apiKey: string | undefined;
    let aiGatewayApiKey: string | undefined;

    // Accept either populated messages or a top-level input (used by some transports on first send)
    const topLevelInput = (body as unknown as { input?: unknown })?.input;
    const hasTopLevelInput =
      typeof topLevelInput === "string" && topLevelInput.trim().length > 0;
    if (
      !model ||
      !((Array.isArray(messages) && messages.length > 0) || hasTopLevelInput)
    ) {
      return new Response(
        JSON.stringify({
          error: "Messages (array) or input and a model are required",
          receivedMessages: messages,
          messagesType: typeof messages,
          inputIncluded: hasTopLevelInput,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sanitize UI messages: strip tool content and placeholders
    const sanitizedUiMessages = cleanMessagesForTools(messages, false);
    if (!sanitizedUiMessages || !Array.isArray(sanitizedUiMessages)) {
      return new Response(
        JSON.stringify({
          error: "Failed to sanitize messages",
          sanitizedMessages: sanitizedUiMessages,
          originalMessages: messages,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const convertedMessages = convertToModelMessages(
      sanitizedUiMessages
    ) as ModelMessage[];

    console.log(
      "API Route - Converted messages:",
      convertedMessages?.map((m) => ({
        role: m.role,
        content: Array.isArray(m.content)
          ? m.content.map((c) => ({
              type: c.type,
              content:
                c.type === "text"
                  ? `${c.text?.substring(0, 100)}...`
                  : c.type === "image"
                    ? "IMAGE"
                    : c,
            }))
          : typeof m.content === "string"
            ? `${m.content.substring(0, 100)}...`
            : m.content,
      }))
    );

    if (!convertedMessages || !Array.isArray(convertedMessages)) {
      return new Response(
        JSON.stringify({
          error: "Failed to convert messages to model format",
          convertedMessages: convertedMessages,
          sanitizedMessages: sanitizedUiMessages,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if this is a vision request (has image parts)
    const containsImages = _hasImageParts(convertedMessages);

    console.log("API Route - Has image parts:", containsImages);

    modelToUse = model || "openai/gpt-4o";

    // Note: Do not block images for AI Gateway based on local heuristics.
    // Some providers may support multimodal even when capability metadata is missing.

    // Keep remote media URLs; avoid inlining large payloads
    const finalConvertedMessages: ModelMessage[] = await _inlineExternalMedia(convertedMessages);

    // Some clients (AI SDK transports) send the user's latest input separately.
    // Capture it here to use as a fallback for providers that need a single text prompt (e.g., Google Gemini).
    const bodyInput: string | undefined = (() => {
      try {
        const anyBody = body as unknown as { input?: unknown };
        return typeof anyBody?.input === "string" &&
          anyBody.input.trim().length > 0
          ? anyBody.input
          : undefined;
      } catch {
        return undefined;
      }
    })();

    console.log("API Route - Received userApiKeys:", {
      hasLlmGatewayKey: !!userApiKeys?.llmGatewayApiKey,
      hasAiGatewayKey: !!userApiKeys?.aiGatewayApiKey,
      llmGatewayKeyLength: userApiKeys?.llmGatewayApiKey?.length || 0,
      aiGatewayKeyLength: userApiKeys?.aiGatewayApiKey?.length || 0,
    });

    if (userApiKeys?.llmGatewayApiKey) {
      apiKey = userApiKeys.llmGatewayApiKey;
    }
    if (userApiKeys?.aiGatewayApiKey) {
      aiGatewayApiKey = userApiKeys.aiGatewayApiKey;
    }

    // Update providers with the actual API keys
    const { llmGatewayProvider, vercelGatewayProvider } = makeProviders({
      llmApiKey: apiKey,
      aiGatewayApiKey,
    });

    if (!apiKey && usedGateway === "llm-gateway") {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Used-Gateway": usedGateway,
      });
      return new Response(
        JSON.stringify({
          error:
            "No LLM Gateway API key configured. Please add your API key in settings.",
          code: "NO_API_KEY",
          usedGateway,
        }),
        { status: 401, headers }
      );
    }

    if (usedGateway === "vercel-ai-gateway" && !aiGatewayApiKey) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Used-Gateway": usedGateway,
      });
      return new Response(
        JSON.stringify({
          error:
            "No Vercel AI Gateway API key configured. Please add your API key in settings.",
          code: "NO_API_KEY",
          usedGateway,
        }),
        { status: 401, headers }
      );
    }

    // Skip preflight streaming-support lookup to avoid an extra network hop.
    // Proactively simulate streaming for OpenAI reasoning models (e.g. o1/o3/o4-mini) which don't support chat streaming.
    const shouldUseSimulatedStreaming = isOpenAIReasoningModel(modelToUse);

    try {
      // Use gateway providers for all requests (vision included)
      const baseModel = getBaseModel({
        usedGateway,
        modelId: modelToUse,
        isOAIReasoning: isOpenAIReasoningModel(modelToUse),
        llmGatewayProvider,
        vercelGatewayProvider,
        reasoningEffort: (config?.openai?.reasoningEffort as "low" | "medium" | "high" | undefined) ?? "medium",
      });

      // No <think> extraction: handle responses as-is per DeepSeek v5 docs and unified reasoning
      const modelForRequest = shouldUseSimulatedStreaming
        ? wrapLanguageModel({
            model: baseModel,
            middleware: simulateStreamingMiddleware(),
          })
        : baseModel;

      const isOAIReasoning = isOpenAIReasoningModel(modelToUse);
      const isOpenAI = isOpenAIProvider(modelToUse);
      const isGoogle = isGoogleModel(modelToUse);
      const _payload = buildPromptPayload({
        isGoogle,
        isOAIReasoning,
        modelId: modelToUse,
        uiMessages: messages as UIMessage[],
        convertedMessages: finalConvertedMessages,
        system,
        bodyInput,
      });
      const result = await streamText({
        model: modelForRequest,
        ...(usedGateway === "vercel-ai-gateway" && isOAIReasoning && containsImages
          ? { system, messages: finalConvertedMessages }
          : _payload.kind === "google"
            ? { system: _payload.system, messages: _payload.messages }
            : _payload.kind === "oai-reasoning"
              ? { system: _payload.system, prompt: _payload.prompt }
              : { system: _payload.system, messages: _payload.messages }),
        ...(isOAIReasoning
          ? {}
          : {
              temperature,
              maxOutputTokens: config?.maxOutputTokens,
              topP: config?.topP,
              topK:
                typeof config?.topK === "number" && config.topK > 0
                  ? config.topK
                  : undefined,
              ...(isOpenAI
                ? {
                    frequencyPenalty: config?.frequencyPenalty,
                    presencePenalty: config?.presencePenalty,
                  }
                : {}),
            }),
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
            ? {
                google: {
                  ...(config?.google || {}),
                  responseModalities: ["TEXT", "IMAGE"],
                },
              }
            : undefined),
        },
      });

      const _stream = createUIMessageStream({
        execute: ({ writer }) => {
          result.consumeStream();
          writer.merge(
            result.toUIMessageStream({
              sendReasoning: true,
            })
          );
        },
      });

      // Return streaming response with gateway header
      const baseResponse = result.toUIMessageStreamResponse({
        sendReasoning: true,
      });
      const headers = new Headers(baseResponse.headers);
      headers.set("X-Used-Gateway", usedGateway);
      headers.set("Cache-Control", "no-store");
      return new Response(baseResponse.body, {
        status: baseResponse.status,
        headers,
      });
    } catch (streamErr: unknown) {
      if (isNoStreamingError(streamErr)) {
        const simulatedStreamingModel = wrapLanguageModel({
          model: getBaseModel({
            usedGateway,
            modelId: modelToUse,
            isOAIReasoning: isOpenAIReasoningModel(modelToUse),
            llmGatewayProvider,
            vercelGatewayProvider,
            reasoningEffort: (config?.openai?.reasoningEffort as "low" | "medium" | "high" | undefined) ?? "medium",
          }),
          middleware: simulateStreamingMiddleware(),
        });

        const isOAIReasoning2 = isOpenAIReasoningModel(modelToUse);
        const isOpenAI2 = isOpenAIProvider(modelToUse);
        const isGoogle2 = isGoogleModel(modelToUse);
        const _payload2 = buildPromptPayload({
          isGoogle: isGoogle2,
          isOAIReasoning: isOAIReasoning2,
          modelId: modelToUse,
          uiMessages: messages as UIMessage[],
          convertedMessages: finalConvertedMessages,
          system,
          bodyInput,
        });
        const result = await streamText({
          model: simulatedStreamingModel,
          ...(usedGateway === "vercel-ai-gateway" && isOAIReasoning2 && containsImages
            ? { system, messages: finalConvertedMessages }
            : _payload2.kind === "google"
              ? { system: _payload2.system, messages: _payload2.messages }
              : _payload2.kind === "oai-reasoning"
                ? { system: _payload2.system, prompt: _payload2.prompt }
                : { system: _payload2.system, messages: _payload2.messages }),
          ...(isOAIReasoning2 ? {} : { temperature }),
          ...(isOAIReasoning2
            ? {}
            : { maxOutputTokens: config?.maxOutputTokens }),
          ...(isOAIReasoning2 ? {} : { topP: config?.topP }),
          ...(isOAIReasoning2
            ? {}
            : {
                topK:
                  typeof config?.topK === "number" && config.topK > 0
                    ? config.topK
                    : undefined,
              }),
          ...(isOAIReasoning2
            ? {}
            : isOpenAI2
              ? { frequencyPenalty: config?.frequencyPenalty }
              : {}),
          ...(isOAIReasoning2
            ? {}
            : isOpenAI2
              ? { presencePenalty: config?.presencePenalty }
              : {}),
          providerOptions: {
            ...buildProviderOptions({
              modelId: modelToUse,
              isOAIReasoning: isOAIReasoning2,
              openai: config?.openai,
              google: config?.google,
              anthropic: config?.anthropic,
              maxOutputTokens: config?.maxOutputTokens,
              system,
            }),
            ...(isGoogle2 && /image-preview/i.test(modelToUse)
              ? {
                  google: {
                    ...(config?.google || {}),
                    responseModalities: ["TEXT", "IMAGE"],
                  },
                }
              : undefined),
          },
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

        // Return simulated streaming response with gateway header
        const headers = new Headers({
          "X-Used-Gateway": usedGateway,
          "Cache-Control": "no-store",
        });
        return new Response(
          stream.pipeThrough(new JsonToSseTransformStream()),
          { headers }
        );
      }

      throw streamErr;
    }
  } catch (err: unknown) {
    console.error("Chat API error:", err);
    return errorResponseForChat(err, modelToUse);
  }
}
