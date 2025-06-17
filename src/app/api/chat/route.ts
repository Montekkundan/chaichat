import { api } from "@/convex/_generated/api";
import type { Attachment } from "@ai-sdk/ui-utils";
import { type Message as MessageAISDK, type ToolSet, streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { FREE_MODELS_IDS, SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { PLANS } from "~/lib/config";
import { getAllModels } from "~/lib/models";
import { openproviders } from "~/lib/openproviders";
import { getProviderForModel } from "~/lib/openproviders/provider-map";
import { modelCost, shouldReset } from "~/lib/subscription";
import { cleanMessagesForTools } from "./utils";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequest = {
	messages: MessageAISDK[];
	chatId: string;
	userId: string;
	model: string;
	isAuthenticated: boolean;
	systemPrompt: string;
	agentId?: string;
	regenerateMessageId?: string;
	temperature?: number;
};

export async function POST(req: Request) {
	try {
		const body = await req.json();

		const {
			messages,
			chatId,
			userId,
			model,
			isAuthenticated,
			systemPrompt,
			agentId,
			regenerateMessageId,
			temperature,
		} = body as ChatRequest;

		if (!messages || !chatId || !userId) {
			return new Response(
				JSON.stringify({ error: "Error, missing information" }),
				{ status: 400 },
			);
		}

		// Initialize Convex client for server-side queries
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
		}
		const convex = new ConvexHttpClient(convexUrl);

		// Check if this is a free model or requires user API key
		const isFreeModel = FREE_MODELS_IDS.includes(model);
		let userApiKeys: Record<string, string | undefined> = {};

		if (!isFreeModel && isAuthenticated) {
			// Get user's API keys for premium models
			try {
				userApiKeys = await convex.query(api.userKeys.getUserKeysForAPI, {
					userId,
				});
			} catch (error) {
				console.error("Failed to fetch user API keys:", error);
			}
		}

		// const supabase = await validateAndTrackUsage({
		//   userId,
		//   model,
		//   isAuthenticated,
		// })

		// const userMessage = messages[messages.length - 1]

		// if (supabase && userMessage?.role === "user") {
		//   await logUserMessage({
		//     supabase,
		//     userId,
		//     chatId,
		//     content: userMessage.content,
		//     attachments: userMessage.experimental_attachments as Attachment[],
		//     model,
		//     isAuthenticated,
		//   })
		// }

		// let agentConfig = null

		// if (agentId) {
		//   agentConfig = await loadAgent(agentId)
		// }

		const allModels = await getAllModels();
		const modelConfig = allModels.find((m) => m.id === model);

		if (!modelConfig || !modelConfig.apiSdk) {
			throw new Error(`Model ${model} not found`);
		}

		// Validate attachment support
		const hasAttachmentsInMessages = messages.some((m) => {
			const attachments = (
				m as unknown as { experimental_attachments?: Attachment[] }
			).experimental_attachments;
			return Array.isArray(attachments) && attachments.length > 0;
		});
		if (
			hasAttachmentsInMessages &&
			!modelConfig?.attachments &&
			!modelConfig?.vision
		) {
			return new Response(
				JSON.stringify({
					error:
						"The selected model does not support file or image attachments.",
					code: "ATTACHMENT_NOT_SUPPORTED",
				}),
				{ status: 400 },
			);
		}

		const effectiveSystemPrompt =
			// agentConfig?.systemPrompt ||
			systemPrompt || SYSTEM_PROMPT_DEFAULT;

		// let toolsToUse = undefined

		// if (agentConfig?.mcpConfig) {
		//   const { tools } = await loadMCPToolsFromURL(agentConfig.mcpConfig.server)
		//   toolsToUse = tools
		// } else if (agentConfig?.tools) {
		// toolsToUse = agentConfig.tools
		// if (supabase) {
		//   await trackSpecialAgentUsage(supabase, userId)
		// }
		// }

		// Clean messages when switching between agents with different tool capabilities
		// const hasTools = !!toolsToUse && Object.keys(toolsToUse).length > 0
		// const cleanedMessages = cleanMessagesForTools(messages, hasTools)

		let streamError: Error | null = null;

		// Determine which API key to use
		let apiKey: string | undefined;

		if (isFreeModel) {
			// Use project API key for free models
			apiKey = undefined; // This will use default project keys from openproviders
		} else {
			// Use user's API key for premium models
			const provider = getProviderForModel(model);
			const userKey = userApiKeys[`${provider}Key`];

			if (!userKey) {
				return new Response(
					JSON.stringify({
						error: `This model requires your own ${provider.toUpperCase()} API key. Please add it in Settings.`,
						code: "API_KEY_REQUIRED",
					}),
					{ status: 403 },
				);
			}

			apiKey = userKey;
		}

		// Get the model instance with the appropriate API key
		const modelInstance = isFreeModel
			? modelConfig.apiSdk(undefined)
			: modelConfig.apiSdk(apiKey);

		// ----------------- Quota checks -----------------
		// Ensure user exists and fetch quota
		const quota = await convex.mutation(api.userQuota.initUser, {
			userId,
			plan: isAuthenticated ? "free" : "anonymous",
		});
		if (!quota) {
			throw new Error("Failed to initialize user quota");
		}

		const now = Date.now();
		let stdCredits = quota.stdCredits ?? 0;
		let premiumCredits = quota.premiumCredits ?? 0;
		let refillAt = quota.refillAt;
		const planInfo = PLANS[quota.plan as keyof typeof PLANS] ?? PLANS.anonymous;
		if (planInfo.periodMs && shouldReset(now, refillAt)) {
			stdCredits = planInfo.total;
			premiumCredits = planInfo.premium;
			refillAt = now + planInfo.periodMs;
			await convex.mutation(api.userQuota.updateQuota, {
				userId,
				std: stdCredits,
				prem: premiumCredits,
				refillAt,
			});
		}

		// Determine cost for requested model
		const cost = modelCost(model);
		if (stdCredits < cost.standard || premiumCredits < cost.premium) {
			return new Response(
				JSON.stringify({
					error: "Quota exceeded. Please upgrade your plan.",
					code: "QUOTA_EXCEEDED",
					remaining: {
						standard: stdCredits,
						premium: premiumCredits,
					},
				}),
				{ status: 403 },
			);
		}

		// Deduct credits
		stdCredits -= cost.standard;
		premiumCredits -= cost.premium;
		await convex.mutation(api.userQuota.updateQuota, {
			userId,
			std: stdCredits,
			prem: premiumCredits,
			refillAt,
		});
		// ------------------------------------------------

		const result = streamText({
			model: modelInstance,
			system: effectiveSystemPrompt,
			messages: messages,
			// tools: toolsToUse as ToolSet,
			maxSteps: 10,
			temperature: temperature || 0.8,
			onError: (err: unknown) => {
				console.error("🛑 streamText error:", err);
				streamError = new Error(
					(err as { error?: string })?.error ||
						"AI generation failed. Please check your model or API key.",
				);
			},
			// onFinish: async ({ response }) => {
			// },
		});

		if (streamError) {
			throw streamError;
		}

		const originalResponse = result.toDataStreamResponse({
			sendReasoning: true,
			sendSources: true,
		});
		const headers = new Headers(originalResponse.headers);
		headers.set("X-Chat-Id", chatId);

		return new Response(originalResponse.body, {
			status: originalResponse.status,
			headers,
		});
	} catch (err: unknown) {
		console.error("Error in /api/chat:", err);
		// Return a structured error response if the error is a UsageLimitError.
		const error = err as { code?: string; message?: string };
		if (error.code === "DAILY_LIMIT_REACHED") {
			return new Response(
				JSON.stringify({ error: error.message, code: error.code }),
				{ status: 403 },
			);
		}

		return new Response(
			JSON.stringify({ error: error.message || "Internal server error" }),
			{ status: 500 },
		);
	}
}
