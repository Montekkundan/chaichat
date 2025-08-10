"use client";

import { useEffect, useState, useCallback } from "react";
import type { LLMGatewayModel } from "~/types/llmgateway";

let memoryCache: {
  data: LLMGatewayModel[] | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

const LOCAL_STORAGE_KEY = "llm_models_cache_v1";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function readLocalStorageCache(): { data: LLMGatewayModel[] | null; timestamp: number } {
  if (typeof window === "undefined") return { data: null, timestamp: 0 };
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { data: null, timestamp: 0 };
    const parsed = JSON.parse(raw) as { data: LLMGatewayModel[]; timestamp: number };
    return parsed && Array.isArray(parsed.data)
      ? { data: parsed.data, timestamp: parsed.timestamp || 0 }
      : { data: null, timestamp: 0 };
  } catch {
    return { data: null, timestamp: 0 };
  }
}

function writeLocalStorageCache(data: LLMGatewayModel[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ data, timestamp: Date.now() })
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

export function useLLMModels(): UseModelsResult {
  const [models, setModels] = useState<LLMGatewayModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/models");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as { models?: LLMGatewayModel[] };
      const nextModels = Array.isArray(payload.models) ? payload.models : [];
      memoryCache = { data: nextModels, timestamp: Date.now() };
      writeLocalStorageCache(nextModels);
      setModels(nextModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    // Force refresh bypassing cache
    memoryCache = { data: null, timestamp: 0 };
    await fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    let isMounted = true;

    const now = Date.now();
    const memData = memoryCache.data;
    const memFresh = memData && now - memoryCache.timestamp < CACHE_DURATION_MS;
    if (memFresh && Array.isArray(memData)) {
      setModels(memData);
      setIsLoading(false);
      return;
    }

    const { data: lsData, timestamp: lsTs } = readLocalStorageCache();
    const lsFresh = lsData && now - lsTs < CACHE_DURATION_MS;
    if (lsFresh && Array.isArray(lsData)) {
      memoryCache = { data: lsData, timestamp: lsTs };
      if (isMounted) {
        setModels(lsData);
        setIsLoading(false);
      }
      return;
    }

    // Otherwise fetch from API
    fetchModels();

    return () => {
      isMounted = false;
    };
  }, [fetchModels]);

  return { models, isLoading, error, refresh };
}

export function invalidateModelsCache() {
  memoryCache = { data: null, timestamp: 0 };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}


