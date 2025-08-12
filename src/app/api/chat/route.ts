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
// import type { LLMGatewayModel } from "~/types/llmgateway";

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
	};
	userApiKeys?: Record<string, string | undefined>;
	// Preferred: which gateway to use (e.g. "llm-gateway" | "vercel-ai-gateway")
	gateway?: string;
};

export async function POST(req: Request) {
	let modelToUse = "openai/gpt-4o";

	try {
		const body = await req.json();

		const {
			messages,
			model,
			system,
			temperature,
			config,
			userApiKeys = {},
			gateway,
		}: ChatRequest = body;

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
				{ status: 400, headers },
			);
		}

		const usedGateway = normalizedGateway;

		if (!messages?.length || !model) {
			return new Response(
				JSON.stringify({ error: "Messages and model are required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

    // Sanitize UI messages: strip tool content and placeholders
    const sanitizedUiMessages = cleanMessagesForTools(messages, false);
    const convertedMessages = convertToModelMessages(sanitizedUiMessages);

		modelToUse = model || "openai/gpt-4o";

		let apiKey: string | undefined;
		let aiGatewayApiKey: string | undefined;

		if (userApiKeys?.llmGatewayApiKey) {
			apiKey = userApiKeys.llmGatewayApiKey;
		}
		if (userApiKeys?.aiGatewayApiKey) {
			aiGatewayApiKey = userApiKeys.aiGatewayApiKey;
		}

		if (!apiKey || !aiGatewayApiKey) {
			try {
				const user = await currentUser();
				if (user?.id) {
					const convexKeys = await convex.action(
						api.userKeys.getUserKeysForAPI,
						{
							userId: user.id,
						},
					);
					if (!apiKey && convexKeys?.llmGatewayApiKey) {
						apiKey = convexKeys.llmGatewayApiKey;
					}
					if (!aiGatewayApiKey && convexKeys?.aiGatewayApiKey) {
						aiGatewayApiKey = convexKeys.aiGatewayApiKey;
					}
				}
			} catch (error) {
				console.warn("Failed to get user API key from Convex:", error);
			}
		}

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
				{ status: 401, headers },
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
				{ status: 401, headers },
			);
		}

		const llmGatewayProvider = createLLMGateway({
			apiKey: apiKey ?? "",
			compatibility: "strict",
		});
		const vercelGatewayProvider = createVercelGateway({
			apiKey: aiGatewayApiKey ?? "",
		});

		// Skip preflight streaming-support lookup to avoid an extra network hop.
		// Proactively simulate streaming for OpenAI reasoning models (e.g. o1/o3/o4-mini) which don't support chat streaming.
		const shouldUseSimulatedStreaming = isOpenAIReasoningModel(modelToUse);

		try {
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
							const prompt = combineTextFromUIMessages(messages as UIMessage[]);
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
              messages: removeEmptyModelMessages(convertedMessages),
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
				providerOptions: buildProviderOptions({
					modelId: modelToUse,
					isOAIReasoning,
					openai: config?.openai,
					google: config?.google,
					maxOutputTokens: config?.maxOutputTokens,
					system,
				}),
			});

			const _stream = createUIMessageStream({
				execute: ({ writer }) => {
					result.consumeStream();
					writer.merge(
						result.toUIMessageStream({
							sendReasoning: true,
						}),
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
								const prompt = combineTextFromUIMessages(
									messages as UIMessage[],
								);
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
                messages: removeEmptyModelMessages(convertedMessages),
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
					providerOptions: buildProviderOptions({
						modelId: modelToUse,
						isOAIReasoning: isOAIReasoning2,
						openai: config?.openai,
						google: config?.google,
						maxOutputTokens: config?.maxOutputTokens,
						system,
					}),
				});

				const stream = createUIMessageStream({
					execute: ({ writer }) => {
						result.consumeStream();
						writer.merge(
							result.toUIMessageStream({
								sendReasoning: true,
							}),
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
					{ headers },
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
				{ status: 400, headers },
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
				{ status: 429, headers },
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
				{ status: 402, headers },
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
			},
		);
	}
}
