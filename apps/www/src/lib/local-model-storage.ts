/**
 * Utility for persisting selected model and provider in localStorage
 */

const MODEL_STORAGE_KEY = "chaichat_selected_model";
const PROVIDER_STORAGE_KEY = "chaichat_selected_provider";

export interface SelectedModelData {
	modelId: string;
	providerId?: string;
	timestamp: number;
}

/**
 * Get the selected model from localStorage
 */
export function getSelectedModel(): SelectedModelData | null {
	if (typeof window === "undefined") return null;

	try {
		const stored = localStorage.getItem(MODEL_STORAGE_KEY);
		if (!stored) return null;

		const data = JSON.parse(stored) as SelectedModelData;

		// Check if the data is too old (older than 30 days)
		const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
		if (data.timestamp < thirtyDaysAgo) {
			removeSelectedModel();
			return null;
		}

		return data;
	} catch (error) {
		console.warn("Failed to read selected model from localStorage:", error);
		return null;
	}
}

/**
 * Save the selected model to localStorage
 */
export function setSelectedModel(modelId: string, providerId?: string): void {
	if (typeof window === "undefined") return;

	try {
		const data: SelectedModelData = {
			modelId,
			providerId,
			timestamp: Date.now(),
		};

		localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(data));
		// Also store the provider separately for backward compatibility
		if (providerId) {
			localStorage.setItem(PROVIDER_STORAGE_KEY, providerId);
		}
	} catch (error) {
		console.warn("Failed to save selected model to localStorage:", error);
	}
}

/**
 * Remove the selected model from localStorage
 */
export function removeSelectedModel(): void {
	if (typeof window === "undefined") return;

	try {
		localStorage.removeItem(MODEL_STORAGE_KEY);
		localStorage.removeItem(PROVIDER_STORAGE_KEY);
	} catch (error) {
		console.warn("Failed to remove selected model from localStorage:", error);
	}
}

/**
 * Get just the model ID (for backward compatibility)
 */
export function getSelectedModelId(): string | null {
	const data = getSelectedModel();
	return data?.modelId || null;
}

/**
 * Get just the provider ID (for backward compatibility)
 */
export function getSelectedProviderId(): string | null {
	const data = getSelectedModel();
	return data?.providerId || null;
}
