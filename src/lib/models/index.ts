// TODO cleanup

import { createDynamicProvider } from "../openproviders";
import { normalizeProviderName } from "./providers";
import { filterModelsByTestedProviders } from "./tested-providers";
import type { ModelConfig } from "./types";

// Re-export the provider components
export { ModelsProvider, useModels } from "./provider";

// Helper function to fetch models from static models.json
async function fetchModelsFromStatic(): Promise<any[]> {
	try {
		if (typeof window !== 'undefined') {
			// Client-side: fetch from public folder
			const response = await fetch('/models.json');
			if (response.ok) {
				const data = await response.json();
				return data.models;
			}
		} else {
			// Server-side: read the static file
			const fs = require('fs');
			const path = require('path');
			const modelsPath = path.join(process.cwd(), 'public', 'models.json');
			
			if (fs.existsSync(modelsPath)) {
				const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
				return modelsData.models;
			}
		}
	} catch (error) {
		console.warn('Failed to load models from static models.json:', error);
	}
	return [];
}

// Minimal fallback models for when Models.dev API is unavailable
const FALLBACK_MODELS: ModelConfig[] = [
	{
		id: "gpt-4o-mini",
		name: "GPT-4o Mini",
		provider: "OpenAI",
		providerId: "openai",
		modelFamily: "GPT-4o",
		description: "Affordable and efficient multimodal model.",
		tags: ["fallback"],
		contextWindow: 128000,
		inputCost: 0.15,
		outputCost: 0.6,
		priceUnit: "per 1M tokens",
		vision: true,
		tools: true,
		audio: false,
		reasoningText: false,
		attachments: true,
		openSource: false,
		speed: "Fast",
		intelligence: "High",
		apiDocs: "https://platform.openai.com/docs/api-reference",
		releasedAt: "2024-07-18",
		apiSdk: (apiKey?: string) => createDynamicProvider("gpt-4o-mini", apiKey),
	},
];

let modelsCache: ModelConfig[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export async function getAllModels(): Promise<ModelConfig[]> {
	const now = Date.now();

	if (modelsCache && now - lastFetchTime < CACHE_DURATION) {
		console.log(`Returning cached models: ${modelsCache.length} models`);
		return modelsCache;
	}

	try {
		console.log('Fetching models from static models.json...');
		const modelsDevData = await fetchModelsFromStatic();
		console.log(`Received ${modelsDevData.length} models from static models.json`);
		
		// Convert Models.dev format to our ModelConfig format
		const convertedModels: ModelConfig[] = modelsDevData.map((model: any) => {
			// Get normalized provider ID
			const providerId = normalizeProviderName(model.provider);
			
			// Create async SDK function that resolves to LanguageModelV1
			let apiSdk: ((apiKey?: string) => Promise<any>) | undefined;
			
			try {
				apiSdk = (apiKey?: string) => createDynamicProvider(model.id, apiKey);
			} catch {
				// Model not supported, leave apiSdk undefined
				apiSdk = undefined;
			}

			return {
				id: model.id,
				name: model.name,
				provider: model.provider,
				providerId,
				modelFamily: model.name.split(' ')[0] || model.provider,
				description: model.description || `${model.name} by ${model.provider}`,
				tags: [],
				contextWindow: model.context_window || 4096,
				inputCost: model.pricing?.input || 0,
				outputCost: model.pricing?.output || 0,
				priceUnit: model.pricing?.unit || "per 1M tokens",
				vision: model.capabilities?.vision || false,
				tools: model.capabilities?.tools || false,
				audio: model.capabilities?.audio || false,
				reasoningText: model.capabilities?.reasoningText || false,
				attachments: model.capabilities?.tools || false,
				openSource: model.open_source || false,
				speed: "Medium",
				intelligence: "Medium",
				releasedAt: model.released_at,
				apiSdk,
			};
		});

		console.log(`Converted ${convertedModels.length} models successfully`);
		
		// Filter models to only include tested providers
		const filteredModels = filterModelsByTestedProviders(convertedModels);
		console.log(`Filtered to ${filteredModels.length} models from tested providers`);
		
		modelsCache = filteredModels;
		lastFetchTime = now;
		return filteredModels;
	} catch (error) {
		console.warn("Failed to load models from static models.json, using fallback:", error);
		console.log(`Returning ${FALLBACK_MODELS.length} fallback models`);
		return FALLBACK_MODELS;
	}
}

export function getModelInfo(modelId: string): ModelConfig | undefined {
	if (modelsCache) {
		return modelsCache.find((model) => model.id === modelId);
	}
	return FALLBACK_MODELS.find((model) => model.id === modelId);
}

export function refreshModelsCache(): void {
	modelsCache = null;
	lastFetchTime = 0;
}
