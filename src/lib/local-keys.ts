export type ProviderId = "openai" | "anthropic" | "google" | "mistral";

export interface UserKeys {
	openaiKey?: string;
	anthropicKey?: string;
	googleKey?: string;
	mistralKey?: string;
}

const LOCAL_KEYS_PREFIX = "chaichat_keys_";
const SESSION_KEYS_PREFIX = "chaichat_session_keys_";

// Get a key from localStorage (persistent)
export function getLocalKey(provider: ProviderId): string | undefined {
	if (typeof window === "undefined") return undefined;

	try {
		return localStorage.getItem(`${LOCAL_KEYS_PREFIX}${provider}`) || undefined;
	} catch (error) {
		console.warn("Failed to read from localStorage:", error);
		return undefined;
	}
}

// Store a key in localStorage (persistent)
export function setLocalKey(provider: ProviderId, key: string): void {
	if (typeof window === "undefined") return;

	try {
		if (key.trim()) {
			localStorage.setItem(`${LOCAL_KEYS_PREFIX}${provider}`, key.trim());
		} else {
			localStorage.removeItem(`${LOCAL_KEYS_PREFIX}${provider}`);
		}
	} catch (error) {
		console.warn("Failed to write to localStorage:", error);
	}
}

// Remove a key from localStorage
export function removeLocalKey(provider: ProviderId): void {
	if (typeof window === "undefined") return;

	try {
		localStorage.removeItem(`${LOCAL_KEYS_PREFIX}${provider}`);
	} catch (error) {
		console.warn("Failed to remove from localStorage:", error);
	}
}

// Get a key from sessionStorage (temporary)
export function getSessionKey(provider: ProviderId): string | undefined {
	if (typeof window === "undefined") return undefined;

	try {
		return (
			sessionStorage.getItem(`${SESSION_KEYS_PREFIX}${provider}`) || undefined
		);
	} catch (error) {
		console.warn("Failed to read from sessionStorage:", error);
		return undefined;
	}
}

// Store a key in sessionStorage (temporary)
export function setSessionKey(provider: ProviderId, key: string): void {
	if (typeof window === "undefined") return;

	try {
		if (key.trim()) {
			sessionStorage.setItem(`${SESSION_KEYS_PREFIX}${provider}`, key.trim());
		} else {
			sessionStorage.removeItem(`${SESSION_KEYS_PREFIX}${provider}`);
		}
	} catch (error) {
		console.warn("Failed to write to sessionStorage:", error);
	}
}

// Remove a key from sessionStorage
export function removeSessionKey(provider: ProviderId): void {
	if (typeof window === "undefined") return;

	try {
		sessionStorage.removeItem(`${SESSION_KEYS_PREFIX}${provider}`);
	} catch (error) {
		console.warn("Failed to remove from sessionStorage:", error);
	}
}

// Get all local keys
export function getAllLocalKeys(): UserKeys {
	return {
		openaiKey: getLocalKey("openai"),
		anthropicKey: getLocalKey("anthropic"),
		googleKey: getLocalKey("google"),
		mistralKey: getLocalKey("mistral"),
	};
}

// Get all session keys
export function getAllSessionKeys(): UserKeys {
	return {
		openaiKey: getSessionKey("openai"),
		anthropicKey: getSessionKey("anthropic"),
		googleKey: getSessionKey("google"),
		mistralKey: getSessionKey("mistral"),
	};
}

// Get all keys (session takes precedence over local)
export function getAllKeys(): UserKeys {
	const localKeys = getAllLocalKeys();
	const sessionKeys = getAllSessionKeys();

	return {
		openaiKey: sessionKeys.openaiKey || localKeys.openaiKey,
		anthropicKey: sessionKeys.anthropicKey || localKeys.anthropicKey,
		googleKey: sessionKeys.googleKey || localKeys.googleKey,
		mistralKey: sessionKeys.mistralKey || localKeys.mistralKey,
	};
}

// Clear all keys from both storages
export function clearAllKeys(): void {
	const providers: ProviderId[] = ["openai", "anthropic", "google", "mistral"];

	for (const provider of providers) {
		removeLocalKey(provider);
		removeSessionKey(provider);
	}
}
