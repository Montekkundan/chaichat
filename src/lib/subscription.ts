import { PREMIUM_MODEL_IDS } from "./config";

export function modelCost(modelId: string) {
  const premium = PREMIUM_MODEL_IDS.includes(modelId) ? 1 : 0;
  return { premium, standard: premium ? 0 : 1 } as const;
}

export function shouldReset(now: number, refillAt?: number) {
  return refillAt !== undefined && now >= refillAt;
} 