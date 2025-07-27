// Secure local storage for API keys (non-logged users)
// Uses Web Crypto API for client-side encryption - free and secure for open source projects

export type ProviderId = "openai" | "anthropic" | "google" | "mistral" | "xai";

export interface UserKeys {
	openaiKey?: string;
	anthropicKey?: string;
	googleKey?: string;
	mistralKey?: string;
	xaiKey?: string;
}

const LOCAL_KEYS_PREFIX = "chaichat_secure_keys_";
const SESSION_KEYS_PREFIX = "chaichat_session_secure_keys_";
const ENCRYPTION_KEY_SALT = "chaichat_encryption_salt";

// Generate a browser-specific fingerprint for key derivation
function getBrowserFingerprint(): string {
	if (typeof window === "undefined") return "ssr-fallback";

	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.textBaseline = "top";
		ctx.font = "14px Arial";
		ctx.fillText("Browser fingerprint", 2, 2);
	}

	const fingerprint = [
		navigator.userAgent,
		navigator.language,
		`${screen.width}x${screen.height}`,
		new Date().getTimezoneOffset(),
		canvas.toDataURL(),
		navigator.hardwareConcurrency || 1,
	].join("|");

	return fingerprint;
}

// Get or create encryption salt
function getOrCreateSalt(): Uint8Array {
	if (typeof window === "undefined") return new Uint8Array(16);

	try {
		const stored = localStorage.getItem(ENCRYPTION_KEY_SALT);
		if (stored) {
			return new Uint8Array(JSON.parse(stored));
		}
	} catch (error) {
		console.warn("Failed to read encryption salt:", error);
	}

	// Create new salt
	const salt = crypto.getRandomValues(new Uint8Array(16));
	try {
		localStorage.setItem(ENCRYPTION_KEY_SALT, JSON.stringify(Array.from(salt)));
	} catch (error) {
		console.warn("Failed to store encryption salt:", error);
	}

	return salt;
}

// Derive encryption key from browser fingerprint + salt
async function deriveEncryptionKey(): Promise<CryptoKey> {
	const fingerprint = getBrowserFingerprint();
	const salt = getOrCreateSalt();

	// Import the fingerprint as key material
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(fingerprint),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	// Derive AES key
	return crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

// Encrypt text
async function encryptText(text: string): Promise<string> {
	try {
		const key = await deriveEncryptionKey();
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const encodedText = new TextEncoder().encode(text);

		const encrypted = await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: iv },
			key,
			encodedText,
		);

		// Combine IV + encrypted data
		const combined = new Uint8Array(iv.length + encrypted.byteLength);
		combined.set(iv);
		combined.set(new Uint8Array(encrypted), iv.length);

		// Return base64 encoded
		return btoa(String.fromCharCode(...combined));
	} catch (error) {
		console.warn("Encryption failed, falling back to plaintext:", error);
		return text; // Fallback to plaintext if encryption fails
	}
}

// Decrypt text
async function decryptText(encryptedText: string): Promise<string> {
	try {
		const key = await deriveEncryptionKey();
		const combined = new Uint8Array(
			atob(encryptedText)
				.split("")
				.map((char) => char.charCodeAt(0)),
		);

		const iv = combined.slice(0, 12);
		const encrypted = combined.slice(12);

		const decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: iv },
			key,
			encrypted,
		);

		return new TextDecoder().decode(decrypted);
	} catch (error) {
		console.warn("Decryption failed, assuming plaintext:", error);
		return encryptedText; // Fallback: assume it's plaintext
	}
}

// Get a key from localStorage (persistent)
export async function getLocalKey(
	provider: ProviderId,
): Promise<string | undefined> {
	if (typeof window === "undefined") return undefined;

	try {
		const encrypted = localStorage.getItem(`${LOCAL_KEYS_PREFIX}${provider}`);
		if (!encrypted) return undefined;

		const decrypted = await decryptText(encrypted);
		return decrypted || undefined;
	} catch (error) {
		console.warn("Failed to read from localStorage:", error);
		return undefined;
	}
}

// Store a key in localStorage (persistent)
export async function setLocalKey(
	provider: ProviderId,
	key: string,
): Promise<void> {
	if (typeof window === "undefined") return;

	try {
		if (key.trim()) {
			const encrypted = await encryptText(key.trim());
			localStorage.setItem(`${LOCAL_KEYS_PREFIX}${provider}`, encrypted);
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
export async function getSessionKey(
	provider: ProviderId,
): Promise<string | undefined> {
	if (typeof window === "undefined") return undefined;

	try {
		const encrypted = sessionStorage.getItem(
			`${SESSION_KEYS_PREFIX}${provider}`,
		);
		if (!encrypted) return undefined;

		const decrypted = await decryptText(encrypted);
		return decrypted || undefined;
	} catch (error) {
		console.warn("Failed to read from sessionStorage:", error);
		return undefined;
	}
}

// Store a key in sessionStorage (temporary)
export async function setSessionKey(
	provider: ProviderId,
	key: string,
): Promise<void> {
	if (typeof window === "undefined") return;

	try {
		if (key.trim()) {
			const encrypted = await encryptText(key.trim());
			sessionStorage.setItem(`${SESSION_KEYS_PREFIX}${provider}`, encrypted);
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
export async function getAllLocalKeys(): Promise<UserKeys> {
	const providers: ProviderId[] = [
		"openai",
		"anthropic",
		"google",
		"mistral",
		"xai",
	];
	const keys: UserKeys = {};

	await Promise.all(
		providers.map(async (provider) => {
			const key = await getLocalKey(provider);
			if (key) {
				keys[`${provider}Key` as keyof UserKeys] = key;
			}
		}),
	);

	return keys;
}

// Get all session keys
export async function getAllSessionKeys(): Promise<UserKeys> {
	const providers: ProviderId[] = [
		"openai",
		"anthropic",
		"google",
		"mistral",
		"xai",
	];
	const keys: UserKeys = {};

	await Promise.all(
		providers.map(async (provider) => {
			const key = await getSessionKey(provider);
			if (key) {
				keys[`${provider}Key` as keyof UserKeys] = key;
			}
		}),
	);

	return keys;
}

// Get all keys (session takes precedence over local)
export async function getAllKeys(): Promise<UserKeys> {
	const [localKeys, sessionKeys] = await Promise.all([
		getAllLocalKeys(),
		getAllSessionKeys(),
	]);

	return {
		openaiKey: sessionKeys.openaiKey || localKeys.openaiKey,
		anthropicKey: sessionKeys.anthropicKey || localKeys.anthropicKey,
		googleKey: sessionKeys.googleKey || localKeys.googleKey,
		mistralKey: sessionKeys.mistralKey || localKeys.mistralKey,
		xaiKey: sessionKeys.xaiKey || localKeys.xaiKey,
	};
}

// Clear all keys from both storages
export function clearAllKeys(): void {
	const providers: ProviderId[] = [
		"openai",
		"anthropic",
		"google",
		"mistral",
		"xai",
	];

	for (const provider of providers) {
		removeLocalKey(provider);
		removeSessionKey(provider);
	}

	// Also clear the encryption salt to force regeneration
	try {
		localStorage.removeItem(ENCRYPTION_KEY_SALT);
	} catch (error) {
		console.warn("Failed to clear encryption salt:", error);
	}
}

// Migration function to upgrade from old plaintext storage
export async function migrateFromPlaintextStorage(): Promise<void> {
	if (typeof window === "undefined") return;

	const OLD_LOCAL_PREFIX = "chaichat_keys_";
	const OLD_SESSION_PREFIX = "chaichat_session_keys_";
	const providers: ProviderId[] = [
		"openai",
		"anthropic",
		"google",
		"mistral",
		"xai",
	];

	let migrated = false;

	// Migrate localStorage
	for (const provider of providers) {
		try {
			const oldKey = localStorage.getItem(`${OLD_LOCAL_PREFIX}${provider}`);
			if (oldKey) {
				await setLocalKey(provider, oldKey);
				localStorage.removeItem(`${OLD_LOCAL_PREFIX}${provider}`);
				migrated = true;
			}
		} catch (error) {
			console.warn(`Failed to migrate local key for ${provider}:`, error);
		}
	}

	// Migrate sessionStorage
	for (const provider of providers) {
		try {
			const oldKey = sessionStorage.getItem(`${OLD_SESSION_PREFIX}${provider}`);
			if (oldKey) {
				await setSessionKey(provider, oldKey);
				sessionStorage.removeItem(`${OLD_SESSION_PREFIX}${provider}`);
				migrated = true;
			}
		} catch (error) {
			console.warn(`Failed to migrate session key for ${provider}:`, error);
		}
	}

	if (migrated) {
		console.log("Successfully migrated API keys to encrypted storage");
	}
}
