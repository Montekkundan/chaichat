import { getAllKeys, type UserKeys } from "~/lib/secure-local-keys";
import { getProviderKeyMap, normalizeProviderName as normalizeProviderFromModelsJson } from "./providers";

/**
 * Get all available model IDs from models.json
 * This is used as fallback when models.json fails to load
 */
async function getAllModelIds(): Promise<string[]> {
	try {
		if (typeof window !== 'undefined') {
			const response = await fetch('/models.json');
			if (response.ok) {
				const data = await response.json();
				return data.models.map((m: any) => m.id);
			}
		} else {
			const fs = require('fs');
			const path = require('path');
			const modelsPath = path.join(process.cwd(), 'public', 'models.json');
			
			if (fs.existsSync(modelsPath)) {
				const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
				return modelsData.models.map((m: any) => m.id);
			}
		}
	} catch (error) {
		console.warn('Failed to load model IDs from models.json:', error);
	}
	
	// Fallback to a few essential models if models.json fails
	return ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet-20241022'];
}

// Dynamic provider key map (loaded from models.json)
let providerKeyMapCache: Record<string, string | undefined> | null = null;
let modelsDataCache: any = null;

/**
 * Get the dynamic provider key mapping
 */
async function getProviderKeyMapping(): Promise<Record<string, string | undefined>> {
	if (!providerKeyMapCache) {
		providerKeyMapCache = await getProviderKeyMap();
	}
	return providerKeyMapCache;
}

/**
 * Initialize caches for sync operations
 */
async function initializeCaches(): Promise<void> {
	if (!providerKeyMapCache) {
		providerKeyMapCache = await getProviderKeyMap();
	}
	if (!modelsDataCache) {
		modelsDataCache = await loadModelsData();
	}
}

/**
 * Get provider ID synchronously from cached data
 */
function extractProviderFromModelIdSync(modelId: string): string | null {
	if (!modelsDataCache?.models) {
		return null;
	}
	
	const model = modelsDataCache.models.find((m: any) => m.id === modelId);
	if (model?.provider) {
		return normalizeProviderFromModelsJson(model.provider);
	}
	
	return null;
}

/**
 * Finds the best available model for a user based on their API keys
 * Used in chat-input to automatically select a good default model when starting a new chat
 * Prioritizes high-quality models like GPT-4o, Claude, Gemini if user has those API keys
 */
export async function getBestAvailableModel(
	userKeys?: UserKeys,
	isAuthenticated = false,
): Promise<string | null> {
	let availableKeys: UserKeys = {};

	if (isAuthenticated && userKeys) {
		availableKeys = userKeys;
	} else if (!isAuthenticated && typeof window !== "undefined") {
		try {
			availableKeys = await getAllKeys();
		} catch (error) {
			console.error("Failed to get local keys:", error);
			return "gpt-4o-mini";
		}
	}

	const hasAnyKeys = Object.values(availableKeys).some((key) => Boolean(key));

	if (!hasAnyKeys) {
		return "gpt-4o-mini";
	}

	// Try preferred high-quality models first
	const preferredModels = [
		"gpt-4o",
		"claude-3-5-sonnet-20241022",
		"gemini-2.0-flash-exp",
		"grok-2-1212",
		"mistral-large-latest",
	];

	const providerKeyMap = await getProviderKeyMapping();

	for (const modelId of preferredModels) {
		const providerId = await extractProviderFromModelId(modelId);
		if (!providerId) continue;

		const keyField = providerKeyMap[providerId];
		if (!keyField) continue;

		if (availableKeys[keyField as keyof UserKeys]) {
			return modelId;
		}
	}

	// If no preferred models available, try any available model
	try {
		const allModelIds = await getAllModelIds();
		for (const modelId of allModelIds) {
			const providerId = await extractProviderFromModelId(modelId);
			if (!providerId) continue;

			const keyField = providerKeyMap[providerId];
			if (!keyField) continue;

			if (availableKeys[keyField as keyof UserKeys]) {
				return modelId;
			}
		}
	} catch (error) {
		console.warn("Failed to get model IDs:", error);
	}

	return "gpt-4o-mini";
}

/**
 * Check if user has an API key for a specific model
 * Used in model selector to show lock icons and disable unavailable models
 */
export async function hasApiKeyForModel(
	modelId: string,
	userKeys: UserKeys,
): Promise<boolean> {
	const providerId = await extractProviderFromModelId(modelId);
	
	if (!providerId) {
		return false;
	}

	const providerKeyMap = await getProviderKeyMapping();
	const keyField = providerKeyMap[providerId];
	
	// If provider doesn't require API key (like Ollama), it's available
	if (!keyField) {
		return true;
	}
	
	return Boolean(userKeys[keyField as keyof UserKeys]);
}

/**
 * Check if a model should be locked/disabled for a user
 * Used in model selector to visually disable models without API keys
 */
export async function isModelLocked(
	modelId: string,
	userKeys: UserKeys | undefined,
	isUserAuthenticated: boolean,
): Promise<boolean> {
	return isModelLockedSync(modelId, userKeys, isUserAuthenticated);
}

/**
 * Synchronous version of hasApiKeyForModel for performance
 */
export function hasApiKeyForModelSync(
	modelId: string,
	userKeys: UserKeys,
): boolean {
	const providerId = extractProviderFromModelIdSync(modelId);
	
	if (!providerId) {
		return false;
	}

	const keyField = providerKeyMapCache?.[providerId];
	
	// If provider doesn't require API key, it's available
	if (!keyField) {
		return true;
	}
	
	return Boolean(userKeys[keyField as keyof UserKeys]);
}

/**
 * Synchronous version of isModelLocked for performance in UI components
 */
export function isModelLockedSync(
	modelId: string,
	userKeys: UserKeys | undefined,
	isUserAuthenticated: boolean,
): boolean {
	if (!userKeys) {
		return true;
	}

	const providerId = extractProviderFromModelIdSync(modelId);
	
	if (!providerId) {
		return true;
	}
	
	const keyField = providerKeyMapCache?.[providerId];
	
	// Models without required API keys (like Ollama) are never locked
	if (!keyField) {
		return false;
	}
	
	return !Boolean(userKeys[keyField as keyof UserKeys]);
}

// Cache for models.json data
let modelsCache: any = null;

/**
 * Load models data from models.json
 * Returns cached data on client, reads file on server
 */
async function loadModelsData(): Promise<any> {
	if (typeof window !== 'undefined') {
		if (!modelsCache) {
			try {
				const response = await fetch('/models.json');
				if (response.ok) {
					modelsCache = await response.json();
				}
			} catch (error) {
				console.warn('Failed to load models.json:', error);
			}
		}
		return modelsCache;
	} else {
		const fs = require('fs');
		const path = require('path');
		const modelsPath = path.join(process.cwd(), 'public', 'models.json');
		
		if (fs.existsSync(modelsPath)) {
			return JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
		}
	}
	return null;
}

/**
 * Extract provider ID from model ID using models.json data
 * This is the core function that determines which API key is needed for each model
 */
async function extractProviderFromModelId(modelId: string): Promise<string | null> {
	try {
		let modelsData = null;
		
		if (typeof window !== 'undefined') {
			modelsData = modelsCache || await loadModelsData();
		} else {
			const fs = require('fs');
			const path = require('path');
			const modelsPath = path.join(process.cwd(), 'public', 'models.json');
			
			if (fs.existsSync(modelsPath)) {
				modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
			}
		}
		
		if (modelsData?.models) {
			const model = modelsData.models.find((m: any) => m.id === modelId);
			if (model?.provider) {
				return normalizeProviderFromModelsJson(model.provider);
			}
		}
	} catch (error) {
		console.warn('Failed to extract provider from models.json:', error);
	}
	
	return null;
}

// Initialize cache on client
if (typeof window !== 'undefined') {
	// Initialize caches immediately for sync operations
	initializeCaches().catch(console.warn);
}

/**
 * Filter a list of models to only include those available to the user
 * Used in model selector to hide locked models from the UI
 */
export async function getAvailableModels(
	allModels: any[],
	userKeys: UserKeys | undefined,
	isUserAuthenticated: boolean,
): Promise<any[]> {
	const availableModels = [];
	
	for (const model of allModels) {
		try {
			const isLocked = await isModelLocked(model.id, userKeys, isUserAuthenticated);
			if (!isLocked) {
				availableModels.push(model);
			}
		} catch (error) {
			console.warn(`Failed to check if model ${model.id} is locked:`, error);
			// If we can't determine the lock status, include the model
			availableModels.push(model);
		}
	}
	
	return availableModels;
}
