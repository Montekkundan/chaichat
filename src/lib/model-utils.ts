import { BYOK_MODEL_IDS } from "~/lib/config";
import { getAllKeys } from "~/lib/secure-local-keys";

export type UserKeys = {
	openaiKey?: string;
	anthropicKey?: string;
	googleKey?: string;
	mistralKey?: string;
	xaiKey?: string;
};

// Map provider IDs to their corresponding key fields
const PROVIDER_KEY_MAP: Record<string, keyof UserKeys> = {
	openai: "openaiKey",
	anthropic: "anthropicKey",
	google: "googleKey",
	mistral: "mistralKey",
	xai: "xaiKey",
};

// Map model IDs to their providers
const MODEL_PROVIDER_MAP: Record<string, string> = {
	"gpt-4o": "openai",
	"claude-3-7-sonnet-20250219": "anthropic",
	"gemini-2.0-flash-001": "google",
	"grok-3": "xai",
	"ministral-3b-latest": "mistral",
};

/**
 * Determines the best model to use based on available API keys
 * @param userKeys - The user's API keys (for logged users)
 * @param isAuthenticated - Whether the user is logged in
 * @returns The best available model ID, or null if no keys available
 */
export async function getBestAvailableModel(
	userKeys?: UserKeys,
	isAuthenticated = false,
): Promise<string | null> {
	let availableKeys: UserKeys = {};

	if (isAuthenticated && userKeys) {
		// Use provided keys for authenticated users
		availableKeys = userKeys;
	} else if (!isAuthenticated && typeof window !== "undefined") {
		// Get local keys for non-authenticated users
		try {
			availableKeys = await getAllKeys();
		} catch (error) {
			console.error("Failed to get local keys:", error);
			return null;
		}
	}

	// Check if user has any API keys
	const hasAnyKeys = Object.values(availableKeys).some((key) => Boolean(key));

	if (!hasAnyKeys) {
		return null; // No keys available
	}

	// Try to find a model that the user has a key for, in order of preference
	const preferredModels = [
		"gpt-4o", // OpenAI
		"claude-3-7-sonnet-20250219", // Anthropic
		"gemini-2.0-flash-001", // Google
		"grok-3", // xAI
		"ministral-3b-latest", // Mistral
	];

	for (const modelId of preferredModels) {
		const providerId = MODEL_PROVIDER_MAP[modelId];
		if (!providerId) continue;

		const keyField = PROVIDER_KEY_MAP[providerId];
		if (!keyField) continue;

		if (availableKeys[keyField]) {
			return modelId;
		}
	}

	// Fallback: return any model where the user has a key
	for (const modelId of BYOK_MODEL_IDS) {
		const providerId = MODEL_PROVIDER_MAP[modelId];
		if (!providerId) continue;

		const keyField = PROVIDER_KEY_MAP[providerId];
		if (!keyField) continue;

		if (availableKeys[keyField]) {
			return modelId;
		}
	}

	return null; // No matching models found
}

/**
 * Checks if a user has the required API key for a specific model
 */
export function hasApiKeyForModel(
	modelId: string,
	userKeys: UserKeys,
): boolean {
	const providerId = MODEL_PROVIDER_MAP[modelId];
	if (!providerId) return false;

	const keyField = PROVIDER_KEY_MAP[providerId];
	if (!keyField) return false;

	return Boolean(userKeys[keyField]);
}
