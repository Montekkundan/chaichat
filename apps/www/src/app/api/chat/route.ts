import { api } from "@/convex/_generated/api";
import { createGateway as createVercelGateway } from "@ai-sdk/gateway";
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
} from "ai";
import type { ModelMessage } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { env } from "~/env";
import {
  buildProviderOptions,
  combineTextFromUIMessages,
  isGoogleModel,
  isOpenAIReasoningModel,
  isOpenAIProvider,
  cleanMessagesForTools,
  removeEmptyModelMessages,
} from "./utils";
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
        const igUsedGateway = (() => {
          if (typeof gateway === "string" && gateway.trim().length > 0) {
            const g = gateway.trim().toLowerCase();
            if (
              g === "llm-gateway" ||
              g === "llm" ||
              g === "llmgateway" ||
              g === "gateway-llm"
            )
              return "llm-gateway" as const;
            if (
              g === "vercel-ai-gateway" ||
              g === "vercel" ||
              g === "ai-gateway" ||
              g === "vercel-ai" ||
              g === "vercelaigateway"
            )
              return "vercel-ai-gateway" as const;
          }
          return "llm-gateway" as const;
        })();

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
    const normalizedGateway = (() => {
      if (typeof gateway === "string" && gateway.trim().length > 0) {
        const g = gateway.trim().toLowerCase();
        if (
          g === "llm-gateway" ||
          g === "llm" ||
          g === "llmgateway" ||
          g === "gateway-llm"
        )
          return "llm-gateway" as const;
        if (
          g === "vercel-ai-gateway" ||
          g === "vercel" ||
          g === "ai-gateway" ||
          g === "vercel-ai" ||
          g === "vercelaigateway"
        )
          return "vercel-ai-gateway" as const;
        return "unsupported" as const;
      }
      return "llm-gateway" as const;
    })();

    if (normalizedGateway === "unsupported") {
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

    const usedGateway = normalizedGateway;

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
    const hasImageParts = convertedMessages.some(
      (msg) =>
        Array.isArray(msg.content) &&
        msg.content.some((part) => part.type === "image")
    );

    console.log("API Route - Has image parts:", hasImageParts);

    modelToUse = model || "openai/gpt-4o";

    // Inline external image URLs as data URIs so models can access them
    async function inlineExternalMedia(
      messages: ModelMessage[]
    ): Promise<ModelMessage[]> {
      const out: ModelMessage[] = [];
      for (const m of messages) {
        if (!Array.isArray(m.content as unknown)) {
          out.push(m);
          continue;
        }
        const parts = m.content as Array<unknown>;
        const newParts: Array<unknown> = [];
        for (const p of parts) {
          const part = p as {
            type?: string;
            image?: string;
            mimeType?: string;
            url?: string;
            mediaType?: string;
          };
          // Do NOT inline large remote media into base64; keep original URLs to avoid oversized payloads
          newParts.push(part);
        }
        out.push({ ...m, content: newParts } as ModelMessage);
      }
      return out;
    }

    const finalConvertedMessages: ModelMessage[] =
      await inlineExternalMedia(convertedMessages);

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
    const llmGatewayProvider = createLLMGateway({
      apiKey: apiKey ?? "",
      compatibility: "strict",
    });
    const vercelGatewayProvider = createVercelGateway({
      apiKey: aiGatewayApiKey ?? "",
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
      const baseModel =
        usedGateway === "vercel-ai-gateway"
          ? vercelGatewayProvider(modelToUse)
          : llmGatewayProvider(modelToUse);

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
      const result = await streamText({
        model: modelForRequest,
        ...(isGoogle
          ? (() => {
              // Prefer combined text from the provided UI messages; fallback to input when conversation is empty/new.
              const combined = combineTextFromUIMessages(
                messages as UIMessage[]
              );
              const prompt =
                combined && combined.trim().length > 0
                  ? combined
                  : (bodyInput ?? "");
              const googleMessages = [
                {
                  role: "user" as const,
                  content: prompt && prompt.length > 0 ? prompt : "",
                },
              ];
              return { system, messages: googleMessages };
            })()
          : {
              system,
              messages: removeEmptyModelMessages<ModelMessage>(
                finalConvertedMessages
              ),
            }),
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
        const providerForFallback =
          usedGateway === "vercel-ai-gateway"
            ? vercelGatewayProvider
            : llmGatewayProvider;
        const simulatedStreamingModel = wrapLanguageModel({
          model: providerForFallback(modelToUse),
          middleware: simulateStreamingMiddleware(),
        });

        const isOAIReasoning2 = isOpenAIReasoningModel(modelToUse);
        const isOpenAI2 = isOpenAIProvider(modelToUse);
        const isGoogle2 = isGoogleModel(modelToUse);
        const result = await streamText({
          model: simulatedStreamingModel,
          ...(isGoogle2
            ? (() => {
                const combined = combineTextFromUIMessages(
                  messages as UIMessage[]
                );
                const prompt =
                  combined && combined.trim().length > 0
                    ? combined
                    : (bodyInput ?? "");
                const googleMessages = [
                  {
                    role: "user" as const,
                    content: prompt && prompt.length > 0 ? prompt : "",
                  },
                ];
                return { system, messages: googleMessages };
              })()
            : {
                system,
                messages: removeEmptyModelMessages<ModelMessage>(
                  finalConvertedMessages
                ),
              }),
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
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";

    if (
      errorMessage.includes("not supported") ||
      errorMessage.includes("Bad Request")
    ) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Used-Gateway": "unknown",
      });
      return new Response(
        JSON.stringify({
          error: `Model "${modelToUse}" is not supported by the LLM Gateway. Please select a different model.`,
          code: "MODEL_NOT_SUPPORTED",
          usedGateway: "unknown",
        }),
        { status: 400, headers }
      );
    }

    if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Used-Gateway": "unknown",
      });
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please wait a moment and try again.",
          code: "RATE_LIMITED",
          usedGateway: "unknown",
        }),
        { status: 429, headers }
      );
    }

    if (
      errorMessage.includes("quota") ||
      errorMessage.includes("insufficient")
    ) {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Used-Gateway": "unknown",
      });
      return new Response(
        JSON.stringify({
          error: "API quota exceeded. Please check your API key limits.",
          code: "QUOTA_EXCEEDED",
          usedGateway: "unknown",
        }),
        { status: 402, headers }
      );
    }

    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Used-Gateway": "unknown",
      "Cache-Control": "no-store",
    });
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
        usedGateway: "unknown",
      }),
      {
        status: 500,
        headers,
      }
    );
  }
}
