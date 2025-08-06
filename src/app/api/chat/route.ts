import { convertToModelMessages, generateText, streamText, type UIMessage } from "ai";
import { createLLMGateway, llmgateway } from "@llmgateway/ai-sdk-provider";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { env } from "../../../env";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const maxDuration = 60;

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
					const convexKeys = await convex.action(api.userKeys.getUserKeysForAPI, { 
						userId: user.id 
					});
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
					error: "No LLM Gateway API key configured. Please add your API key in settings.",
					code: "NO_API_KEY"
				}),
				{ status: 401, headers: { "Content-Type": "application/json" } }
			);
		}

		const llmGatewayProvider = createLLMGateway({
			apiKey: apiKey,
			compatibility: 'strict'
		});
		
		const response = await streamText({
			model: llmGatewayProvider(modelToUse),
			system,
			messages: convertedMessages,
			temperature,
		});

		return response.toUIMessageStreamResponse();

	} catch (err: unknown) {
		console.error("Chat API error:", err);
		const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
		
		if (errorMessage.includes("not supported") || errorMessage.includes("Bad Request")) {
			return new Response(
				JSON.stringify({ 
					error: `Model "${modelToUse}" is not supported by the LLM Gateway. Please select a different model.`,
					code: "MODEL_NOT_SUPPORTED"
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}
		
		if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
			return new Response(
				JSON.stringify({ 
					error: "Rate limit exceeded. Please wait a moment and try again.",
					code: "RATE_LIMITED"
				}),
				{ status: 429, headers: { "Content-Type": "application/json" } }
			);
		}

		if (errorMessage.includes("quota") || errorMessage.includes("insufficient")) {
			return new Response(
				JSON.stringify({ 
					error: "API quota exceeded. Please check your API key limits.",
					code: "QUOTA_EXCEEDED"
				}),
				{ status: 402, headers: { "Content-Type": "application/json" } }
			);
		}
		
		return new Response(
			JSON.stringify({ 
				error: "Internal server error", 
				details: errorMessage 
			}),
			{ 
				status: 500, 
				headers: { "Content-Type": "application/json" } 
			}
		);
	}
}
