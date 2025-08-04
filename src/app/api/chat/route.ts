import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createDynamicProvider } from "~/lib/openproviders";
import { getProviderKeyMap } from "~/lib/models/providers";

export const maxDuration = 60;

type ChatRequest = {
	messages: UIMessage[];
	model: string;
	system?: string;
	temperature?: number;
	userApiKeys?: Record<string, string | undefined>;
};

function extractProviderFromModelId(modelId: string): string | null {
	try {
		const fs = require('fs');
		const path = require('path');
		const modelsPath = path.join(process.cwd(), 'public', 'models.json');
		
		if (fs.existsSync(modelsPath)) {
			const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
			const { filterModelsJsonByTested } = require('~/lib/models/tested-providers');
			const filteredData = filterModelsJsonByTested(modelsData);
			const model = filteredData?.models?.find((m: any) => m.id === modelId);
			
			if (model?.provider) {
				return model.provider
					.toLowerCase()
					.replace(/[^a-z0-9]/g, '-')
					.replace(/-+/g, '-')
					.replace(/^-|-$/g, '');
			}
		}
	} catch (error) {
		console.warn('Failed to extract provider from models.json:', error);
	}
	
	return null;
}

export async function POST(req: Request) {
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

		const providerId = extractProviderFromModelId(model);
		const keyMap = await getProviderKeyMap();
		const keyField = keyMap[providerId || ""];
		const apiKey = keyField ? userApiKeys[keyField] : undefined;
		const modelInstance = await createDynamicProvider(model, apiKey);
		
		if (!modelInstance) {
			return new Response(
				JSON.stringify({ error: `Failed to create model instance for: ${model}` }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}

		const convertedMessages = convertToModelMessages(messages);
		
		if (providerId === "google" && (!convertedMessages || convertedMessages.length === 0)) {
			return new Response(
				JSON.stringify({ error: "No valid messages provided for Google Gemini" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}
		
		const result = streamText({
			model: modelInstance,
			system,
			messages: convertedMessages,
			temperature,
		});
		
		return result.toUIMessageStreamResponse();
		
	} catch (err: unknown) {
		console.error("Chat API error:", err);
		const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
		
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
