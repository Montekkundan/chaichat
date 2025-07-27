"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

// Simplified - no more quota tracking since we removed pricing
interface QuotaInfo {
	plan: "free"; // Everyone is on the free plan now
}

const QuotaContext = createContext<QuotaInfo>({
	plan: "free",
});

export function useQuota() {
	return useContext(QuotaContext);
}

export function QuotaProvider({ children }: { children: ReactNode }) {
	const value = useMemo(
		() => ({
			plan: "free" as const,
		}),
		[],
	);

	return (
		<QuotaContext.Provider value={value}>{children}</QuotaContext.Provider>
	);
}
