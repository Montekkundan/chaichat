"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal type used internally by this hook. The component defines its own display type.
type LLMGatewayModel = {
	id: string;
	name: string;
	description?: string;
	family?: string;
	architecture?: Record<string, unknown>;
	providers?: Array<{
		providerId: string;
		modelName: string;
		pricing?: Record<string, unknown>;
		streaming?: boolean;
		vision?: boolean;
		tools?: boolean;
	}>;
	pricing?: Record<string, string | undefined>;
	context_length?: number;
	json_output?: boolean;
	deprecated_at?: string | null;
	deactivated_at?: string | null;
};

type Source = "llm" | "aigw";

let memoryCache: Record<
	Source,
	{ data: LLMGatewayModel[] | null; timestamp: number }
> = {
	llm: { data: null, timestamp: 0 },
	aigw: { data: null, timestamp: 0 },
};

// De-duplicate concurrent network requests across multiple hook instances
const inflightFetch: Partial<Record<Source, Promise<LLMGatewayModel[]>>> = {};

const LOCAL_STORAGE_KEY_BASE = "llm_models_cache_v1";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function lsKeyFor(source: Source): string {
	return `${LOCAL_STORAGE_KEY_BASE}_${source}`;
}

function readLocalStorageCache(source: Source): {
	data: LLMGatewayModel[] | null;
	timestamp: number;
} {
	if (typeof window === "undefined") return { data: null, timestamp: 0 };
	try {
		const raw = window.localStorage.getItem(lsKeyFor(source));
		if (!raw) return { data: null, timestamp: 0 };
		const parsed = JSON.parse(raw) as {
			data: LLMGatewayModel[];
			timestamp: number;
		};
		return parsed && Array.isArray(parsed.data)
			? { data: parsed.data, timestamp: parsed.timestamp || 0 }
			: { data: null, timestamp: 0 };
	} catch {
		return { data: null, timestamp: 0 };
	}
}

function writeLocalStorageCache(source: Source, data: LLMGatewayModel[]) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			lsKeyFor(source),
			JSON.stringify({ data, timestamp: Date.now() }),
		);
	} catch {
		// ignore storage errors (quota, privacy, etc.)
	}
}

type UseModelsResult = {
	models: LLMGatewayModel[];
	isLoading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
};

export function useLLMModels(options?: {
	source?: "aigateway" | "llmgateway";
	controlled?: boolean;
}): UseModelsResult {
	const [models, setModels] = useState<LLMGatewayModel[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [useAiGateway, setUseAiGateway] = useState<boolean>(false);
	const prefetchingRef = useRef(false);

	const isControlled =
		Boolean(options?.controlled) && typeof options?.source === "string";
	const controlledUseAiGateway = options?.source === "aigateway";

	const fetchModels = useCallback(
		async (overrideUseAiGateway?: boolean) => {
			setIsLoading(true);
			setError(null);
			try {
				const effectiveUseAiGateway =
					typeof overrideUseAiGateway === "boolean"
						? overrideUseAiGateway
						: isControlled
							? controlledUseAiGateway
							: useAiGateway;
				const route = effectiveUseAiGateway
					? "/api/models/ai-gateway"
					: "/api/models";
				// For AI Gateway, read from localStorage key set by the registry UI
				let headerKey = "";
				if (typeof window !== "undefined") {
					headerKey = window.localStorage?.getItem("chaichat_registry_aigateway") || "";
				}
				const source: Source = effectiveUseAiGateway ? "aigw" : "llm";

				if (!inflightFetch[source]) {
					inflightFetch[source] = (async () => {
						const response = await fetch(route, {
							headers:
								effectiveUseAiGateway && headerKey
									? { Authorization: `Bearer ${headerKey}` }
									: undefined,
						});
						if (!response.ok) throw new Error(`HTTP ${response.status}`);
						const payload = (await response.json()) as {
							models?: LLMGatewayModel[];
						};
						const nextModels = Array.isArray(payload.models)
							? payload.models
							: [];
						memoryCache[source] = { data: nextModels, timestamp: Date.now() };
						writeLocalStorageCache(source, nextModels);
						return nextModels;
					})();
				}

				const inflight = inflightFetch[source];
				const result = inflight ? await inflight : [];
				setModels(result);
				// cleanup once resolved so future refreshes can occur
				delete inflightFetch[source];
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load models");
			} finally {
				setIsLoading(false);
			}
		},
		[useAiGateway, isControlled, controlledUseAiGateway],
	);

	const refresh = useCallback(async () => {
		memoryCache = {
			llm: { data: null, timestamp: 0 },
			aigw: { data: null, timestamp: 0 },
		};
		await fetchModels();
	}, [fetchModels]);

	useEffect(() => {
		let isMounted = true;

		if (!isControlled) {
			if (prefetchingRef.current) {
				return () => {
					isMounted = false;
				};
			}
		}

		const now = Date.now();
		const source: Source = (
			isControlled
				? controlledUseAiGateway
				: useAiGateway
		)
			? "aigw"
			: "llm";
		const memData = memoryCache[source].data;
		const memFresh =
			memData && now - memoryCache[source].timestamp < CACHE_DURATION_MS;
		if (memFresh && Array.isArray(memData)) {
			setModels(memData);
			setIsLoading(false);
			return;
		}

		const { data: lsData, timestamp: lsTs } = readLocalStorageCache(source);
		const lsFresh = lsData && now - lsTs < CACHE_DURATION_MS;
		if (lsFresh && Array.isArray(lsData)) {
			memoryCache[source] = { data: lsData, timestamp: lsTs };
			if (isMounted) {
				setModels(lsData);
				setIsLoading(false);
			}
			return;
		}

		// Otherwise fetch from API
		fetchModels(isControlled ? controlledUseAiGateway : undefined);

		return () => {
			isMounted = false;
		};
	}, [fetchModels, useAiGateway, isControlled, controlledUseAiGateway]);

	// Uncontrolled: Listen to storage events to switch global source
	useEffect(() => {
		if (isControlled) return;
		const readSource = () => {
			try {
				const raw = window.localStorage.getItem("chaichat_registry_models_source");
				const next = raw === "aigateway";
				setUseAiGateway((prev) => {
					if (prev !== next) {
						// prefetch immediately when toggled to reduce flash
						prefetchingRef.current = true;
						void fetchModels(next).finally(() => {
							prefetchingRef.current = false;
						});
					}
					return next;
				});
			} catch {}
		};
		readSource();
		const onToggle = () => readSource();
		window.addEventListener("registryModelsSourceChanged", onToggle as EventListener);
		window.addEventListener("storage", onToggle);
		return () => {
			window.removeEventListener(
				"registryModelsSourceChanged",
				onToggle as EventListener,
			);
			window.removeEventListener("storage", onToggle);
		};
	}, [fetchModels, isControlled]);

	return { models, isLoading, error, refresh };
}

export function invalidateModelsCache() {
	memoryCache = {
		llm: { data: null, timestamp: 0 },
		aigw: { data: null, timestamp: 0 },
	};
	if (typeof window !== "undefined") {
		try {
			window.localStorage.removeItem(lsKeyFor("llm"));
			window.localStorage.removeItem(lsKeyFor("aigw"));
		} catch {
			// ignore
		}
	}
}

export default useLLMModels;

 