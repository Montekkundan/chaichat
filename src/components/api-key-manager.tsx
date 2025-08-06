"use client";

import { ExternalLink, Key, Eye, EyeOff } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import {
	getAllKeys,
	setLocalKey,
	setSessionKey,
	removeLocalKey,
	removeSessionKey,
} from "~/lib/local-keys";

export function ApiKeyManager() {
	const { user } = useUser();
	const isLoggedIn = !!user?.id;
	const [llmGatewayKey, setLlmGatewayKey] = useState("");
	const [showKey, setShowKey] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [useSessionStorage, setUseSessionStorage] = useState(false);

	// Convex mutations for logged-in users
	const storeKeyMutation = useMutation(api.userKeys.storeKey);
	const removeKeyMutation = useMutation(api.userKeys.removeKey);
	const getKeysAction = useAction(api.userKeys.getKeys);

	useEffect(() => {
		const loadExistingKey = async () => {
			try {
				setIsLoading(true);
				if (isLoggedIn) {
					const convexKeys = await getKeysAction({});
					if (convexKeys?.llmGatewayApiKey) {
						setLlmGatewayKey(convexKeys.llmGatewayApiKey);
					}
				} else {
					const localKeys = getAllKeys();
					if (localKeys.llmGatewayApiKey) {
						setLlmGatewayKey(localKeys.llmGatewayApiKey);
					}
				}
			} catch (error) {
				console.error("Failed to load existing key:", error);
			} finally {
				setIsLoading(false);
			}
		};

		loadExistingKey();
	}, [isLoggedIn, getKeysAction]);

	const handleRemoveKey = async () => {
		try {
			if (isLoggedIn) {
				await removeKeyMutation({ provider: "llmgateway" as any });
			} else {
				removeLocalKey("llmgateway");
				removeSessionKey("llmgateway");
			}

			setLlmGatewayKey("");
			toast.success("LLM Gateway API key removed");

			// Dispatch event to notify other components
			window.dispatchEvent(new CustomEvent('apiKeysChanged'));
		} catch (error) {
			console.error("Failed to remove API key:", error);
			toast.error("Failed to remove API key");
		}
	};

	const toggleKeyVisibility = () => {
		setShowKey((prev) => !prev);
	};

	const handleKeyChange = async (value: string) => {
		setLlmGatewayKey(value);
		
		// Auto-save when user types or pastes
		const trimmedKey = value.trim();
		
		if (!trimmedKey) {
			await handleRemoveKey();
			return;
		}

		try {
			if (isLoggedIn) {
				await storeKeyMutation({ 
					provider: "llmgateway" as any, 
					apiKey: trimmedKey 
				});
			} else {
				if (useSessionStorage) {
					await setSessionKey("llmgateway", trimmedKey);
				} else {
					await setLocalKey("llmgateway", trimmedKey);
				}
			}

			window.dispatchEvent(new CustomEvent('apiKeysChanged'));
		} catch (error) {
			console.error("Failed to save API key:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="rounded-lg border bg-card p-6">
				<div className="text-center text-muted-foreground">Loading API key...</div>
			</div>
		);
	}

	const hasKey = Boolean(llmGatewayKey);
	const status = hasKey ? "Active" : "Missing";

	return (
		<div className="space-y-4">
			<div className="mb-4">
				<div className="mb-2 flex items-center gap-2">
					<Key className="size-5" />
					<h3 className="text-lg font-semibold">LLM Gateway API Key</h3>
				</div>
				<p className="mb-3 text-foreground text-sm">
					Configure your LLM Gateway API key to access all supported AI models through a unified interface.
				</p>

				{!isLoggedIn && (
					<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
						<div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
							<Key className="size-4" />
							<span className="text-sm font-medium">Storage Options</span>
						</div>
						<p className="mt-1 text-amber-700 text-xs dark:text-amber-300">
							Keys are stored locally. Use session storage for temporary use or local storage for persistence.
						</p>
						<div className="mt-2 flex items-center gap-2">
							<input
								type="checkbox"
								id="session-storage"
								checked={useSessionStorage}
								onChange={(e) => setUseSessionStorage(e.target.checked)}
								className="rounded"
							/>
							<label htmlFor="session-storage" className="text-amber-700 text-xs dark:text-amber-300">
								Use session storage (temporary)
							</label>
						</div>
					</div>
				)}
			</div>

			{/* LLM Gateway Key Configuration */}
			<div className="rounded-lg border bg-card p-4">
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="font-medium">LLM Gateway</span>
							<Badge
								className={cn(
									status === "Missing" &&
										"bg-muted-foreground/60 text-primary-foreground",
									status === "Active" && "bg-green-600 text-white"
								)}
							>
								{status}
							</Badge>
						</div>
					</div>
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={() => window.open('https://docs.llmgateway.io', '_blank')}
							title="API Documentation"
						>
							<ExternalLink className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="flex gap-2 items-center">
					<div className="relative flex-1">
						<Input
							type={showKey ? "text" : "password"}
							placeholder="Enter your LLM Gateway API key"
							value={llmGatewayKey}
							onChange={(e) => handleKeyChange(e.target.value)}
							className="pr-20 text-sm"
						/>
						<div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0"
								onClick={toggleKeyVisibility}
								title={showKey ? "Hide key" : "Show key"}
							>
								{showKey ? (
									<EyeOff className="h-3 w-3" />
								) : (
									<Eye className="h-3 w-3" />
								)}
							</Button>
						</div>
					</div>
				</div>

				<p className="mt-2 text-xs text-muted-foreground">
					Get your API key from{" "}
					<a 
						href="https://llmgateway.io" 
						target="_blank" 
						rel="noopener noreferrer"
						className="underline hover:no-underline"
					>
						llmgateway.io
					</a>
				</p>
			</div>
		</div>
	);
}
