import { TESTED_PROVIDERS, ENABLE_ALL_PROVIDERS } from "~/lib/config";
import type { ModelConfig } from "./types";
import type { ProviderConfig } from "./providers";

/**
 * Check if a provider is in the tested providers list
 */
export function isProviderTested(providerName: string): boolean {
	// If all providers are enabled (development mode), allow everything
	if (ENABLE_ALL_PROVIDERS) {
		return true;
	}
	
	// Check if the provider is in the tested list (case-insensitive)
	return TESTED_PROVIDERS.some(
		testedProvider => testedProvider.toLowerCase() === providerName.toLowerCase()
	);
}

/**
 * Filter models to only include those from tested providers
 */
export function filterModelsByTestedProviders(models: ModelConfig[]): ModelConfig[] {
	// If all providers are enabled, return all models
	if (ENABLE_ALL_PROVIDERS) {
		return models;
	}
	
	return models.filter(model => isProviderTested(model.provider));
}

/**
 * Filter provider configs to only include tested providers
 */
export function filterProvidersByTested(providers: ProviderConfig[]): ProviderConfig[] {
	// If all providers are enabled, return all providers
	if (ENABLE_ALL_PROVIDERS) {
		return providers;
	}
	
	return providers.filter(provider => isProviderTested(provider.name));
}

/**
 * Filter models.json data to only include tested providers
 */
export function filterModelsJsonByTested(modelsData: any): any {
	// If all providers are enabled, return original data
	if (ENABLE_ALL_PROVIDERS || !modelsData) {
		return modelsData;
	}
	
	const filteredData = {
		...modelsData,
		models: modelsData.models?.filter((model: any) => 
			isProviderTested(model.provider)
		) || [],
		providers: {}
	};
	
	// Filter providers section
	if (modelsData.providers) {
		for (const [providerName, providerData] of Object.entries(modelsData.providers)) {
			if (isProviderTested(providerName)) {
				filteredData.providers[providerName] = providerData;
			}
		}
	}
	
	return filteredData;
}

/**
 * Get list of tested provider names for debugging/info
 */
export function getTestedProvidersList(): string[] {
	return [...TESTED_PROVIDERS];
}

/**
 * Check if all providers mode is enabled
 */
export function isAllProvidersEnabled(): boolean {
	return ENABLE_ALL_PROVIDERS;
}
