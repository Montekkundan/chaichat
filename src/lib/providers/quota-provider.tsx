"use client";

import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import {
  createContext,
  useContext,
  useMemo,
  useEffect,
} from "react";
import type { ReactNode } from "react";
import { getAnonId } from "~/lib/anon-id";

interface QuotaInfo {
  plan: "anonymous" | "free" | "pro";
  stdCredits: number;
  premiumCredits: number;
  refillAt?: number;
}

const QuotaContext = createContext<QuotaInfo | null>(null);

export function useQuota() {
  const ctx = useContext(QuotaContext);
  if (!ctx) throw new Error("useQuota must be used within QuotaProvider");
  return ctx;
}

export function QuotaProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();

  // Decide which identifier to use (Clerk or anonymous)
  const userId = user?.id ?? (typeof window !== "undefined" ? getAnonId() : undefined);

  const quota = useQuery(
    api.userQuota.getQuota,
    userId ? { userId } : "skip",
  );

  const initUser = useMutation(api.userQuota.initUser);

  useEffect(() => {
    if (!userId) return;
    initUser({ userId, plan: user?.id ? "free" : "anonymous" });
  }, [userId, user?.id, initUser]);

  const value = useMemo(() => {
    if (!quota) {
      return {
        plan: (user?.id ? "free" : "anonymous") as "anonymous" | "free" | "pro",
        stdCredits: 0,
        premiumCredits: 0,
      };
    }
    return quota as QuotaInfo;
  }, [quota, user?.id]);

  return <QuotaContext.Provider value={value}>{children}</QuotaContext.Provider>;
} 