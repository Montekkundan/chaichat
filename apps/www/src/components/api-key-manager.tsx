"use client";

import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useAction, useMutation } from "convex/react";
import { ExternalLink, Eye, EyeOff, Key } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	getAllKeys,
	removeLocalKey,
	removeSessionKey,
	setLocalKey,
	setSessionKey,
} from "~/lib/local-keys";
import { cn } from "~/lib/utils";

export function ApiKeyManager() {
	const { user } = useUser();
	const isLoggedIn = !!user?.id;
	const [llmGatewayKey, setLlmGatewayKey] = useState("");
	const [aiGatewayKey, setAiGatewayKey] = useState("");
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
					if (convexKeys?.aiGatewayApiKey) {
						setAiGatewayKey(convexKeys.aiGatewayApiKey);
					}
				} else {
					const localKeys = getAllKeys();
					if (localKeys.llmGatewayApiKey) {
						setLlmGatewayKey(localKeys.llmGatewayApiKey);
					}
					if (localKeys.aiGatewayApiKey) {
						setAiGatewayKey(localKeys.aiGatewayApiKey);
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
				await removeKeyMutation({ provider: "llmgateway" });
			} else {
				removeLocalKey("llmgateway");
				removeSessionKey("llmgateway");
			}

			setLlmGatewayKey("");
			toast.success("LLM Gateway API key removed");

			// Dispatch event to notify other components
			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to remove API key:", error);
			toast.error("Failed to remove API key");
		}
	};

	const handleRemoveAiGatewayKey = async () => {
		try {
			if (isLoggedIn) {
				await removeKeyMutation({ provider: "aigateway" });
			} else {
				removeLocalKey("aigateway");
				removeSessionKey("aigateway");
			}
			setAiGatewayKey("");
			toast.success("Vercel AI Gateway API key removed");
			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to remove AI Gateway API key:", error);
			toast.error("Failed to remove AI Gateway API key");
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
					provider: "llmgateway",
					apiKey: trimmedKey,
				});
			} else {
				if (useSessionStorage) {
					await setSessionKey("llmgateway", trimmedKey);
				} else {
					await setLocalKey("llmgateway", trimmedKey);
				}
			}

			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to save API key:", error);
		}
	};

	const handleAiGatewayKeyChange = async (value: string) => {
		setAiGatewayKey(value);
		const trimmedKey = value.trim();
		if (!trimmedKey) {
			await handleRemoveAiGatewayKey();
			return;
		}
		try {
			if (isLoggedIn) {
				await storeKeyMutation({ provider: "aigateway", apiKey: trimmedKey });
			} else {
				if (useSessionStorage) {
					await setSessionKey("aigateway", trimmedKey);
				} else {
					await setLocalKey("aigateway", trimmedKey);
				}
			}
			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to save AI Gateway API key:", error);
		}
	};

	if (isLoading) {
		return (
			<div className="rounded-lg border bg-card p-6">
				<div className="text-center text-muted-foreground">
					Loading API key...
				</div>
			</div>
		);
	}

	const hasKey = Boolean(llmGatewayKey);
	const status = hasKey ? "Active" : "Missing";
	const aiStatus = aiGatewayKey ? "Active" : "Missing";

	return (
		<div className="space-y-4">
			<div className="mb-4">
				<div className="mb-2 flex items-center gap-2">
					<Key className="size-5" />
					<h3 className="font-semibold text-lg">LLM Gateway API Key</h3>
				</div>
				<p className="mb-3 text-foreground text-sm">
					Configure your LLM Gateway API key to access all supported AI models
					through a unified interface.
				</p>

				{!isLoggedIn && (
					<div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
						<div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
							<Key className="size-4" />
							<span className="font-medium text-sm">Storage Options</span>
						</div>
						<p className="mt-1 text-amber-700 text-xs dark:text-amber-300">
							Keys are stored locally. Use session storage for temporary use or
							local storage for persistence.
						</p>
						<div className="mt-2 flex items-center gap-2">
							<input
								type="checkbox"
								id="session-storage"
								checked={useSessionStorage}
								onChange={(e) => setUseSessionStorage(e.target.checked)}
								className="rounded"
							/>
							<label
								htmlFor="session-storage"
								className="text-amber-700 text-xs dark:text-amber-300"
							>
								Use session storage (temporary)
							</label>
						</div>
					</div>
				)}
			</div>

			{/* LLM Gateway Key Configuration */}
			<div className="rounded-lg border bg-card p-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="font-medium">LLM Gateway</span>
							<Badge
								className={cn(
									status === "Missing" &&
										"bg-muted-foreground/60 text-primary-foreground",
									status === "Active" && "bg-green-600 text-white",
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
							onClick={() =>
								window.open("https://docs.llmgateway.io", "_blank")
							}
							title="API Documentation"
						>
							<ExternalLink className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Input
							type={showKey ? "text" : "password"}
							placeholder="Enter your LLM Gateway API key"
							value={llmGatewayKey}
							onChange={(e) => handleKeyChange(e.target.value)}
							className="pr-20 text-sm"
						/>
						<div className="-translate-y-1/2 absolute top-1/2 right-2 flex gap-1">
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

				<p className="mt-2 text-muted-foreground text-xs">
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

			{/* Vercel AI Gateway Key Configuration */}
			<div className="rounded-lg border bg-card p-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="font-medium">Vercel AI Gateway</span>
							<Badge
								className={cn(
									aiStatus === "Missing" &&
										"bg-muted-foreground/60 text-primary-foreground",
									aiStatus === "Active" && "bg-green-600 text-white",
								)}
							>
								{aiStatus}
							</Badge>
						</div>
					</div>
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={() =>
								window.open("https://vercel.com/docs/ai-gateway", "_blank")
							}
							title="Docs"
						>
							<ExternalLink className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Input
							type={showKey ? "text" : "password"}
							placeholder="Enter your Vercel AI Gateway API key"
							value={aiGatewayKey}
							onChange={(e) => handleAiGatewayKeyChange(e.target.value)}
							className="pr-20 text-sm"
						/>
						<div className="-translate-y-1/2 absolute top-1/2 right-2 flex gap-1">
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
							{aiGatewayKey && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 px-2"
									onClick={handleRemoveAiGatewayKey}
								>
									Remove
								</Button>
							)}
						</div>
					</div>
				</div>

				<p className="mt-2 text-muted-foreground text-xs">
					See docs at{" "}
					<a
						href="https://vercel.com/docs/ai-gateway"
						target="_blank"
						rel="noopener noreferrer"
						className="underline hover:no-underline"
					>
						Vercel AI Gateway
					</a>
				</p>
			</div>
		</div>
	);
}
