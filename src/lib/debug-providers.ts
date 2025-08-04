import { TESTED_PROVIDERS, ENABLE_ALL_PROVIDERS } from "./config";
import { getTestedProvidersList, isAllProvidersEnabled } from "./models/tested-providers";

/**
 * Debug utility to log current provider configuration
 */
export function logProviderConfig() {
	console.group("🔧 Provider Configuration");
	console.log("All providers enabled:", isAllProvidersEnabled());
	console.log("Tested providers:", getTestedProvidersList());
	
	if (isAllProvidersEnabled()) {
		console.log("⚠️  ALL PROVIDERS MODE - All providers from models.json will be available");
	} else {
		console.log("✅ TESTED PROVIDERS MODE - Only the following providers will be available:");
		getTestedProvidersList().forEach(provider => {
			console.log(`  - ${provider}`);
		});
	}
	console.groupEnd();
}

/**
 * Debug utility to get current provider status
 */
export function getProviderDebugInfo() {
	return {
		allProvidersEnabled: isAllProvidersEnabled(),
		testedProviders: getTestedProvidersList(),
		mode: isAllProvidersEnabled() ? "ALL_PROVIDERS" : "TESTED_ONLY",
		envVariable: process.env.ENABLE_ALL_PROVIDERS,
	};
}

/**
 * Debug utility to check if a specific provider is enabled
 */
export function isProviderEnabled(providerName: string): boolean {
	if (isAllProvidersEnabled()) {
		return true;
	}
	return getTestedProvidersList().some(
		tested => tested.toLowerCase() === providerName.toLowerCase()
	);
}
