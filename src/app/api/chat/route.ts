import { api } from "@/convex/_generated/api";
import type { Attachment } from "@ai-sdk/ui-utils";
import { createDataStream } from "ai";
import { generateId } from "ai";
import { type Message as MessageAISDK, streamText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { FREE_MODELS_IDS, SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { PLANS } from "~/lib/config";
import { getAllModels } from "~/lib/models";
import { getProviderForModel } from "~/lib/openproviders/provider-map";
import { modelCost, shouldReset } from "~/lib/subscription";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TODO: ⚠️ Resumable streams still buggy; fix ASAP.
// ---------------- Resumable stream helpers ----------------
const streamContext = createResumableStreamContext({ waitUntil: after });

// Lightweight in-memory map chatId -> streamIds (stored on globalThis).
const chatStreams: Map<string, string[]> = ((): Map<string, string[]> => {
	const g = globalThis as unknown as {
		__chaiChatStreams__?: Map<string, string[]>;
	};
	if (!g.__chaiChatStreams__) {
		g.__chaiChatStreams__ = new Map<string, string[]>();
	}
	return g.__chaiChatStreams__;
})();

function appendStreamId(chatId: string, streamId: string) {
	const arr = chatStreams.get(chatId) ?? [];
	arr.push(streamId);
	chatStreams.set(chatId, arr);
}

function loadStreams(chatId: string): string[] {
	return chatStreams.get(chatId) ?? [];
}

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
				userApiKeys = await convex.action(api.userKeys.getUserKeysForAPI, {
					userId,
				});
			} catch (error) {
				console.error("Failed to fetch user API keys:", error);
			}
		}

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

		let streamError: unknown | null = null;

		// Determine which API key to use
		let apiKey: string | undefined;
		let isBYOK = false; // true when user supplies their own premium key

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
			isBYOK = true;
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
		const baseCost = modelCost(model);
		const effectiveCost = {
			standard: baseCost.standard,
			premium: isBYOK ? 0 : baseCost.premium,
		};

		if (
			stdCredits < effectiveCost.standard ||
			premiumCredits < effectiveCost.premium
		) {
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

		// Deduct credits according to adjusted cost
		stdCredits -= effectiveCost.standard;
		premiumCredits -= effectiveCost.premium;
		await convex.mutation(api.userQuota.updateQuota, {
			userId,
			std: stdCredits,
			prem: premiumCredits,
			refillAt,
		});
		// ------------------------------------------------

		// Filter out system messages and any messages that have no content or attachments.
		// Gemini (and some other providers) return an error if a message has an empty "parts" array.
		const filteredMessages = messages.filter((m) => {
			if (m.role === "system") return false;

			// Accept if there is non-empty textual content.
			if (typeof m.content === "string" && m.content.trim().length > 0) {
				return true;
			}

			// Otherwise, check if the message carries attachments.
			const attachments = (
				m as unknown as { experimental_attachments?: Attachment[] }
			).experimental_attachments;

			return Array.isArray(attachments) && attachments.length > 0;
		});

		const streamId = generateId();

		// Record stream id for resumptions
		appendStreamId(chatId, streamId);

		const aiStream = streamText({
			model: modelInstance,
			system: effectiveSystemPrompt,
			messages: filteredMessages,
			maxSteps: 10,
			temperature: temperature || 0.8,
			onError: (err: unknown) => {
				console.error("🛑 Provider/stream error:", err);
				streamError = err;
			},
		});

		if (streamError) {
			const errObj = streamError as Record<string, unknown>;
			const msg =
				typeof errObj?.error === "string"
					? errObj.error
					: ((streamError as Error)?.message ?? String(streamError));
			return new Response(
				JSON.stringify({ error: msg, code: "PROVIDER_ERROR" }),
				{ status: 502 },
			);
		}

		// DataStream wrapper for resumable support
		const dataStream = createDataStream({
			// `execute` pipes provider chunks into the resumable DataStream.
			execute(buffer: unknown) {
				aiStream.mergeIntoDataStream(buffer as never);
			},
		});

		const originalResponse = await streamContext.resumableStream(
			streamId,
			() => dataStream,
		);

		if (!originalResponse) {
			// fallback shouldn't happen but just in case
			return new Response("Failed to create stream", { status: 500 });
		}

		return new Response(originalResponse, {
			status: 200,
			headers: new Headers(),
		});
	} catch (err: unknown) {
		console.error("Error in /api/chat:", err);
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

// ---------------- GET handler for resuming streams ----------------

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const chatId = searchParams.get("chatId");

	if (!chatId) return new Response("chatId required", { status: 400 });

	const streams = loadStreams(chatId);
	if (streams.length === 0) return new Response("No streams", { status: 404 });

	// `streams.length` is guaranteed to be > 0 here due to early return above.
	const recent = streams[streams.length - 1] as string;

	const emptyDataStream = createDataStream({ execute: () => {} });

	const resumed = await streamContext.resumableStream(
		recent,
		() => emptyDataStream,
	);
	if (resumed) return new Response(resumed, { status: 200 });

	return new Response(emptyDataStream, { status: 200 });
}
