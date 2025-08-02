import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createDynamicProvider } from "~/lib/openproviders";
import { getProviderKeyMap } from "~/lib/models/providers";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

type ChatRequest = {
	messages: UIMessage[];
	model: string;
	system?: string;
	temperature?: number;
	userApiKeys?: Record<string, string | undefined>;
};

// Helper function to extract provider from model ID
function extractProviderFromModelId(modelId: string): string | null {
	try {
		const fs = require('fs');
		const path = require('path');
		const modelsPath = path.join(process.cwd(), 'public', 'models.json');
		
		if (fs.existsSync(modelsPath)) {
			const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
			const model = modelsData?.models?.find((m: any) => m.id === modelId);
			
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

		// Validation
		if (!messages?.length || !model) {
			return new Response(
				JSON.stringify({ error: "Messages and model are required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		// Get API key using provider mapping
		const providerId = extractProviderFromModelId(model);
		const keyMap = await getProviderKeyMap();
		const keyField = keyMap[providerId || ""];
		const apiKey = keyField ? userApiKeys[keyField] : undefined;

		// Create the dynamic model instance
		const modelInstance = await createDynamicProvider(model, apiKey);
		
		if (!modelInstance) {
			return new Response(
				JSON.stringify({ error: `Failed to create model instance for: ${model}` }),
				{ status: 500, headers: { "Content-Type": "application/json" } }
			);
		}

		// Stream the response using AI SDK v5
		const result = streamText({
			model: modelInstance,
			system,
			messages: convertToModelMessages(messages),
			temperature,
		});

		// Return the proper v5 streaming response
		return result.toUIMessageStreamResponse();
		
	} catch (err: unknown) {
		console.error("Chat API error:", err);
		
		const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
		
		// Handle specific error types
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
