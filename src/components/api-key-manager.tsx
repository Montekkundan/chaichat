"use client";

import { useUser } from "@clerk/nextjs";
import { Eye, EyeSlash, Key, X } from "@phosphor-icons/react";
import { useMutation, useAction } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "~/../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	type ProviderId,
	getAllKeys,
	removeLocalKey,
	removeSessionKey,
	setLocalKey,
	setSessionKey,
} from "~/lib/secure-local-keys";
import { useConvex } from "convex/react";

const PROVIDERS: { id: ProviderId; name: string; placeholder: string }[] = [
	{ id: "openai", name: "OpenAI", placeholder: "sk-... (from OpenAI dashboard)" },
	{ id: "anthropic", name: "Anthropic", placeholder: "sk-ant-... (from Anthropic console)" },
	{ id: "google", name: "Google", placeholder: "AI... (from Google AI Studio)" },
	{ id: "mistral", name: "Mistral", placeholder: "mst-... (from Mistral platform)" },
	{ id: "xai", name: "xAI/Grok", placeholder: "xai-... (from xAI console)" },
];

export function ApiKeyManager() {
	const { user } = useUser();
	const convex = useConvex();
	const isLoggedIn = !!user?.id;

	const [keys, setKeys] = useState<Record<string, string>>({});
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [useSessionStorage, setUseSessionStorage] = useState(false);

	// Convex mutations for logged-in users
	const storeKeyMutation = useMutation(api.userKeys.storeKey);
	const removeKeyMutation = useMutation(api.userKeys.removeKey);
	const getKeysAction = useAction(api.userKeys.getKeys);

	// Load keys on mount
	useEffect(() => {
		const loadKeys = async () => {
			if (isLoggedIn) {
				// For logged users, fetch from Convex
				try {
					// Use the Convex query to get keys
					const convexKeys = await getKeysAction({});
					// Filter out undefined values and convert to Record<string, string>
					const filteredKeys: Record<string, string> = {};
					if (convexKeys) {
						for (const [key, value] of Object.entries(convexKeys)) {
							if (value) {
								const provider = key.replace("Key", "") as ProviderId;
								filteredKeys[provider] = value as string;
							}
						}
					}
					setKeys(filteredKeys);
				} catch (error) {
					console.error("Failed to load keys from Convex:", error);
				}
			} else {
				// For non-logged users, fetch from local storage
				try {
					const localKeys = await getAllKeys();
					const formattedKeys: Record<string, string> = {};
					for (const [key, value] of Object.entries(localKeys)) {
						if (value) {
							const provider = key.replace("Key", "") as ProviderId;
							formattedKeys[provider] = value;
						}
					}
					setKeys(formattedKeys);
				} catch (error) {
					console.error("Failed to load keys from local storage:", error);
				}
			}
			setIsLoading(false);
		};

		loadKeys();
	}, [isLoggedIn, getKeysAction]);

	// Notify other components when keys change
	useEffect(() => {
		// Dispatch a custom event to notify other components
		window.dispatchEvent(new CustomEvent('apiKeysChanged', { detail: keys }));
	}, [keys]);

	const handleSaveKey = async (provider: ProviderId, key: string) => {
		const trimmedKey = key.trim();

		if (!trimmedKey) {
			await handleRemoveKey(provider);
			return;
		}

		try {
			if (isLoggedIn) {
				// Store in Convex for logged users
				await storeKeyMutation({ provider, apiKey: trimmedKey });
				toast.success(
					`${PROVIDERS.find((p) => p.id === provider)?.name} API key saved securely`,
				);
			} else {
				// Store in encrypted local/session storage for non-logged users
				if (useSessionStorage) {
					await setSessionKey(provider, trimmedKey);
					toast.success(
						`${PROVIDERS.find((p) => p.id === provider)?.name} API key saved for this session`,
					);
				} else {
					await setLocalKey(provider, trimmedKey);
					toast.success(
						`${PROVIDERS.find((p) => p.id === provider)?.name} API key saved locally (encrypted)`,
					);
				}
			}

			setKeys((prev) => ({ ...prev, [provider]: trimmedKey }));
		} catch (error) {
			console.error("Failed to save API key:", error);
			toast.error("Failed to save API key");
		}
	};

	const handleRemoveKey = async (provider: ProviderId) => {
		try {
			if (isLoggedIn) {
				// Remove from Convex for logged users
				await removeKeyMutation({ provider });
			} else {
				// Remove from local storage for non-logged users
				removeLocalKey(provider);
				removeSessionKey(provider);
			}

			setKeys((prev) => {
				const newKeys = { ...prev };
				delete newKeys[provider];
				return newKeys;
			});

			toast.success(
				`${PROVIDERS.find((p) => p.id === provider)?.name} API key removed`,
			);
		} catch (error) {
			console.error("Failed to remove API key:", error);
			toast.error("Failed to remove API key");
		}
	};

	const toggleKeyVisibility = (provider: ProviderId) => {
		setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
	};

	if (isLoading) {
		return (
			<div className="rounded-lg border bg-card p-6">
				<div className="text-center text-muted-foreground">
					Loading API keys...
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border bg-card p-6 relative z-50">
			<div className="mb-4 relative z-50">
				<div className="mb-2 flex items-center gap-2">
					<Key className="size-5" />
					<h2 className="font-semibold text-xl">API Key Management</h2>
				</div>
				<p className="text-sm mb-3 text-foreground relative z-50">
					{isLoggedIn
						? "Your API keys are stored securely in your account and synced across devices."
						: "Your API keys are encrypted and stored locally in your browser for privacy."}
				</p>

				{!isLoggedIn && (
					<div className="mt-3 rounded-lg bg-muted/50 p-3 relative z-50">
						<div className="mb-2 flex items-center gap-2">
							<input
								type="checkbox"
								id="session-storage"
								checked={useSessionStorage}
								onChange={(e) => setUseSessionStorage(e.target.checked)}
								className="rounded"
							/>
							<Label htmlFor="session-storage" className="text-sm">
								Use session storage (keys deleted when browser closes)
							</Label>
						</div>
						<p className="text-muted-foreground text-xs">
							Recommended for shared computers. Uncheck to persist keys between
							sessions.
						</p>
					</div>
				)}
			</div>

			<div className="space-y-3 relative z-50">
				{PROVIDERS.map((provider) => {
					const currentKey = keys[provider.id] || "";
					const isVisible = showKeys[provider.id] || false;

					return (
						<div key={provider.id} className="space-y-2 relative z-50">
							<Label htmlFor={provider.id} className="font-medium text-sm">
								{provider.name} API Key
							</Label>
							<div className="flex gap-2">
								<div className="relative flex-1">
									<Input
										id={provider.id}
										type={isVisible ? "text" : "password"}
										placeholder={provider.placeholder}
										value={currentKey}
										onChange={(e) => {
											const newValue = e.target.value;
											setKeys((prev) => ({
												...prev,
												[provider.id]: newValue,
											}));
											
											const trimmedValue = newValue.trim();
											if (trimmedValue && trimmedValue !== currentKey) {
												const isValidKey = PROVIDERS.find(p => p.id === provider.id)?.placeholder.includes(trimmedValue.substring(0, 3)) ||
													trimmedValue.startsWith('sk-') || 
													trimmedValue.startsWith('sk-ant-') || 
													trimmedValue.startsWith('AI') || 
													trimmedValue.startsWith('mst-') || 
													trimmedValue.startsWith('xai-');
												
												if (isValidKey) {
													// Small delay to avoid saving while user is still typing
													setTimeout(() => {
														handleSaveKey(provider.id, trimmedValue);
													}, 500);
												}
											}
										}}
										onBlur={(e) => {
											const value = e.target.value.trim();
											if (value !== currentKey) {
												handleSaveKey(provider.id, value);
											}
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												handleSaveKey(provider.id, e.currentTarget.value);
											}
										}}
										className="pr-20"
									/>
									<div className="-translate-y-1/2 absolute top-1/2 right-2 flex gap-1">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0"
											onClick={() => toggleKeyVisibility(provider.id)}
										>
											{isVisible ? (
												<EyeSlash className="size-3" />
											) : (
												<Eye className="size-3" />
											)}
										</Button>
										{currentKey && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0 text-destructive hover:text-destructive"
												onClick={() => handleRemoveKey(provider.id)}
											>
												<X className="size-3" />
											</Button>
										)}
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>

			<div className="mt-4 rounded-lg bg-muted/30 p-3 relative z-50">
				<h3 className="mb-2 font-medium text-sm">🔒 Security & Privacy</h3>
				<ul className="space-y-1 text-muted-foreground text-xs">
					{isLoggedIn ? (
						<>
							<li>• Keys are stored securely in your Convex account</li>
							<li>• Keys sync across all your devices</li>
							<li>• Keys are only accessible to you</li>
						</>
					) : (
						<>
							<li>• Keys are encrypted using AES-256-GCM encryption</li>
							<li>
								• Encryption key derived from browser fingerprint + random salt
							</li>
							<li>• Keys never leave your browser</li>
							<li>• Consider logging in to sync keys across devices</li>
						</>
					)}
				</ul>
			</div>
		</div>
	);
}
