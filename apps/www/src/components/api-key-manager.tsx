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
import { GatewayUptime } from "./app-sidebar/gateway-uptime";

export function ApiKeyManager() {
	const { user } = useUser();
	const isLoggedIn = !!user?.id;
	const [llmGatewayKey, setLlmGatewayKey] = useState("");
	const [aiGatewayKey, setAiGatewayKey] = useState("");
	const [uploadThingKey, setUploadThingKey] = useState("");
	const [vercelBlobKey, setVercelBlobKey] = useState("");
	const [storageProvider, setStorageProvider] = useState<"uploadthing" | "vercelblob">("uploadthing");
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
					if (convexKeys?.uploadThingApiKey) {
						setUploadThingKey(convexKeys.uploadThingApiKey);
					}
					if (convexKeys?.vercelBlobApiKey) {
						setVercelBlobKey(convexKeys.vercelBlobApiKey);
					}
					if (convexKeys?.storageProvider) {
						setStorageProvider(convexKeys.storageProvider);
					}
				} else {
					const localKeys = getAllKeys();
					if (localKeys.llmGatewayApiKey) {
						setLlmGatewayKey(localKeys.llmGatewayApiKey);
					}
					if (localKeys.aiGatewayApiKey) {
						setAiGatewayKey(localKeys.aiGatewayApiKey);
					}
					if (localKeys.uploadThingApiKey) {
						setUploadThingKey(localKeys.uploadThingApiKey);
					}
					if (localKeys.vercelBlobApiKey) {
						setVercelBlobKey(localKeys.vercelBlobApiKey);
					}
					const storedProvider = localStorage.getItem("chai-storage-provider");
					if (storedProvider === "uploadthing" || storedProvider === "vercelblob") {
						setStorageProvider(storedProvider);
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

	const handleStorageProviderChange = async (provider: "uploadthing" | "vercelblob") => {
		setStorageProvider(provider);
		try {
			if (isLoggedIn) {
				await storeKeyMutation({ provider: "storage", apiKey: provider });
			} else {
				localStorage.setItem("chai-storage-provider", provider);
			}
			window.dispatchEvent(new CustomEvent("storageProviderChanged"));
		} catch (error) {
			console.error("Failed to save storage provider:", error);
		}
	};

	const handleUploadThingKeyChange = async (value: string) => {
		setUploadThingKey(value);
		const trimmedKey = value.trim();
		if (!trimmedKey) {
			await handleRemoveUploadThingKey();
			return;
		}

		// Extract the actual token before saving
		let cleanToken = trimmedKey;
		// Remove surrounding quotes if present
		cleanToken = cleanToken.replace(/^['"]|['"]$/g, '');
		// If it starts with UPLOADTHING_TOKEN=, extract the actual token
		if (cleanToken.startsWith('UPLOADTHING_TOKEN=')) {
			cleanToken = cleanToken.replace('UPLOADTHING_TOKEN=', '');
			// Remove surrounding quotes again after extraction
			cleanToken = cleanToken.replace(/^['"]|['"]$/g, '');
		}

		try {
			if (isLoggedIn) {
				await storeKeyMutation({ provider: "uploadthing", apiKey: cleanToken });
			} else {
				if (useSessionStorage) {
					await setSessionKey("uploadthing", cleanToken);
				} else {
					await setLocalKey("uploadthing", cleanToken);
				}
			}
			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to save UploadThing API key:", error);
		}
	};

	const handleVercelBlobKeyChange = async (value: string) => {
		setVercelBlobKey(value);
		const trimmedKey = value.trim();
		if (!trimmedKey) {
			await handleRemoveVercelBlobKey();
			return;
		}
		try {
			if (isLoggedIn) {
				await storeKeyMutation({ provider: "vercelblob", apiKey: trimmedKey });
			} else {
				if (useSessionStorage) {
					await setSessionKey("vercelblob", trimmedKey);
				} else {
					await setLocalKey("vercelblob", trimmedKey);
				}
			}
			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to save Vercel Blob API key:", error);
		}
	};

	const handleRemoveUploadThingKey = async () => {
		try {
			if (isLoggedIn) {
				await removeKeyMutation({ provider: "uploadthing" });
			} else {
				removeLocalKey("uploadthing");
				removeSessionKey("uploadthing");
			}
			setUploadThingKey("");
			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to remove UploadThing API key:", error);
			toast.error("Failed to remove UploadThing API key");
		}
	};

	const handleRemoveVercelBlobKey = async () => {
		try {
			if (isLoggedIn) {
				await removeKeyMutation({ provider: "vercelblob" });
			} else {
				removeLocalKey("vercelblob");
				removeSessionKey("vercelblob");
			}
			setVercelBlobKey("");
			window.dispatchEvent(new CustomEvent("apiKeysChanged"));
		} catch (error) {
			console.error("Failed to remove Vercel Blob API key:", error);
			toast.error("Failed to remove Vercel Blob API key");
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
							{llmGatewayKey && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 px-2"
									onClick={handleRemoveKey}
								>
									Remove
								</Button>
							)}
						</div>
					</div>
				</div>

				{/* Gateway Uptime Status */}
				<div className="mt-3">
					<GatewayUptime endpoint="/api/llm-gateway-health" />
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

			{/* Storage Provider Configuration */}
			<div className="rounded-lg border bg-card p-4">
				<div className="mb-3 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="font-medium">Image Storage</span>
							<Badge className="bg-green-600 text-white">
								Active: {storageProvider === "uploadthing" ? "UploadThing" : "Vercel Blob"}
							</Badge>
						</div>
					</div>
				</div>

				<div className="space-y-4">
					{/* Storage Provider Selection */}
					<div>
						<label className="font-medium text-sm">Storage Provider</label>
						<div className="mt-2 flex gap-2">
							<label className="flex items-center space-x-2">
								<input
									type="radio"
									name="storageProvider"
									value="uploadthing"
									checked={storageProvider === "uploadthing"}
									onChange={(e) => handleStorageProviderChange(e.target.value as "uploadthing")}
									className="rounded"
								/>
								<span className="text-sm">UploadThing</span>
							</label>
							<label className="flex items-center space-x-2">
								<input
									type="radio"
									name="storageProvider"
									value="vercelblob"
									checked={storageProvider === "vercelblob"}
									onChange={(e) => handleStorageProviderChange(e.target.value as "vercelblob")}
									className="rounded"
								/>
								<span className="text-sm">Vercel Blob</span>
							</label>
						</div>
					</div>

					{/* UploadThing Key Configuration */}
					{storageProvider === "uploadthing" && (
						<div>
							<label className="font-medium text-sm">UploadThing API Key</label>
							<div className="flex items-center gap-2 mt-2">
								<div className="relative flex-1">
									<Input
										type={showKey ? "text" : "password"}
										placeholder="Enter your UploadThing API key"
										value={uploadThingKey}
										onChange={(e) => handleUploadThingKeyChange(e.target.value)}
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
										{uploadThingKey && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-6 px-2"
												onClick={handleRemoveUploadThingKey}
											>
												Remove
											</Button>
										)}
									</div>
								</div>
							</div>
							<p className="mt-2 text-muted-foreground text-xs">
								Get your API key from{" "}
								<a
									href="https://uploadthing.com"
									target="_blank"
									rel="noopener noreferrer"
									className="underline hover:no-underline"
								>
									uploadthing.com
								</a>
							</p>
						</div>
					)}

					{/* Vercel Blob Key Configuration */}
					{storageProvider === "vercelblob" && (
						<div>
							<label className="font-medium text-sm">Vercel Blob API Key</label>
							<div className="flex items-center gap-2 mt-2">
								<div className="relative flex-1">
									<Input
										type={showKey ? "text" : "password"}
										placeholder="Enter your Vercel Blob API key"
										value={vercelBlobKey}
										onChange={(e) => handleVercelBlobKeyChange(e.target.value)}
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
										{vercelBlobKey && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-6 px-2"
												onClick={handleRemoveVercelBlobKey}
											>
												Remove
											</Button>
										)}
									</div>
								</div>
							</div>
							<p className="mt-2 text-muted-foreground text-xs">
								Get your API key from{" "}
								<a
									href="https://vercel.com/docs/storage/vercel-blob"
									target="_blank"
									rel="noopener noreferrer"
									className="underline hover:no-underline"
								>
									Vercel Blob
								</a>
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
