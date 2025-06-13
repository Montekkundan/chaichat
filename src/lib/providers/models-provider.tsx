"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { fetchClient } from "~/lib/fetch";
import type { ModelConfig } from "~/lib/models/types";

type ModelsContextType = {
	models: ModelConfig[];
	isLoading: boolean;
	error: string | null;
	refetch: () => Promise<void>;
};

const ModelsContext = createContext<ModelsContextType | undefined>(undefined);

export function ModelsProvider({ children }: { children: React.ReactNode }) {
	const [models, setModels] = useState<ModelConfig[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchModels = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const response = await fetchClient("/api/models");
			if (!response.ok) {
				throw new Error("Failed to fetch models");
			}

			const data = await response.json();
			setModels(data.models || []);
		} catch (err) {
			console.error("Failed to load models:", err);
			setError(err instanceof Error ? err.message : "Failed to load models");
			setModels([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		// Only run on client side
		if (typeof window === "undefined") return;
		fetchModels();
	}, [fetchModels]);

	const value: ModelsContextType = {
		models,
		isLoading,
		error,
		refetch: fetchModels,
	};

	return (
		<ModelsContext.Provider value={value}>{children}</ModelsContext.Provider>
	);
}

export function useModels() {
	const context = useContext(ModelsContext);
	if (context === undefined) {
		throw new Error("useModels must be used within a ModelsProvider");
	}
	return context;
}
