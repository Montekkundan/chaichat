import { api } from "@/convex/_generated/api";
import { currentUser } from "@clerk/nextjs/server";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import {
	JsonToSseTransformStream,
	type UIMessage,
	convertToModelMessages,
	createUIMessageStream,
	extractReasoningMiddleware,
	simulateStreamingMiddleware,
	streamText,
	wrapLanguageModel,
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
	modelId: string,
): Promise<boolean | undefined> {
	const models = await getLLMGatewayModels();
	const { providerId, modelName } = parseProviderAndModel(modelId);

	const match = models.find(
		(m) =>
			m?.id === modelName ||
			m?.name === modelName ||
			m?.id === modelId ||
			m?.name === modelId,
	);
	if (!match) return undefined;
	const providers = Array.isArray(match?.providers) ? match.providers : [];
	if (providerId) {
		const p = providers.find(
			(prov) =>
				prov?.providerId === providerId &&
				(prov?.modelName === modelName || prov?.modelName === modelId),
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
	requested: number | undefined,
): number | undefined {
	if (requiresDefaultTemperatureOne(modelId)) {
		return 1;
	}
	return requested;
}

async function getReasoningParams(
	modelId: string,
): Promise<Record<string, unknown>> {
	const { providerId, modelName } = parseProviderAndModel(modelId);
	const models = await getLLMGatewayModels();
	const match = models.find(
		(m) =>
			m?.id === modelName ||
			m?.name === modelName ||
			m?.id === modelId ||
			m?.name === modelId,
	);
	const supported = new Set(
		(match?.supported_parameters ?? []).map((p) => p.toLowerCase()),
	);

	// OpenAI O-series supports structured reasoning via `reasoning` param
	if (
		(providerId === "openai" || !providerId) &&
		modelName?.startsWith("o3") &&
		(supported.has("reasoning") || supported.has("internal_reasoning"))
	) {
		return { reasoning: { effort: "medium" } };
	}

	// DeepSeek R1 often exposes hidden thinking; some gateways toggle via include_reasoning/internal_reasoning
	if (
		(providerId === "deepseek" || modelName?.toLowerCase().includes("r1")) &&
		(supported.has("include_reasoning") || supported.has("internal_reasoning"))
	) {
		return { include_reasoning: true };
	}

	return {};
}

type ChatRequest = {
	messages: UIMessage[];
	model: string;
	system?: string;
	temperature?: number;
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
			userApiKeys = {},
		}: ChatRequest = body;

		if (!messages?.length || !model) {
			return new Response(
				JSON.stringify({ error: "Messages and model are required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
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
						},
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
				{ status: 401, headers: { "Content-Type": "application/json" } },
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
			// Always extract <think> reasoning on the server so the UI never sees it as plain text
			const withReasoning = wrapLanguageModel({
				model: baseModel,
				middleware: extractReasoningMiddleware({ tagName: "think" }),
			});
			const modelForRequest = shouldUseSimulatedStreaming
				? wrapLanguageModel({
						model: withReasoning,
						middleware: simulateStreamingMiddleware(),
					})
				: withReasoning;

			const effectiveTemperature = normalizeTemperatureForModel(
				modelToUse,
				temperature,
			);

			const reasoningParams = await getReasoningParams(modelToUse);
			const result = await streamText({
				model: modelForRequest,
				system,
				messages: convertedMessages,
				temperature: effectiveTemperature,
				...(reasoningParams as Record<string, unknown>),
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

			return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
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
					model: wrapLanguageModel({
						model: llmGatewayProvider(modelToUse),
						middleware: extractReasoningMiddleware({ tagName: "think" }),
					}),
					middleware: simulateStreamingMiddleware(),
				});

				const effectiveTemperature = normalizeTemperatureForModel(
					modelToUse,
					temperature,
				);
				const reasoningParams = await getReasoningParams(modelToUse);
				const result = await streamText({
					model: simulatedStreamingModel,
					system,
					messages: convertedMessages,
					temperature: effectiveTemperature,
					...(reasoningParams as Record<string, unknown>),
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
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
			return new Response(
				JSON.stringify({
					error: "Rate limit exceeded. Please wait a moment and try again.",
					code: "RATE_LIMITED",
				}),
				{ status: 429, headers: { "Content-Type": "application/json" } },
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
				{ status: 402, headers: { "Content-Type": "application/json" } },
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
			},
		);
	}
}
