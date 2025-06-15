import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { PLANS } from "../src/lib/config";

export const getUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("userId"), userId))
      .first();
  },
});

export const initUser = mutation({
  args: { userId: v.string(), plan: v.optional(v.string()) },
  handler: async (ctx, { userId, plan }) => {
    const existing = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("userId"), userId))
      .first();

    const planToUse = (plan as "anonymous" | "free" | "pro") || "anonymous";

    if (existing) {
      // Patch missing or outdated fields
      const updates: Record<string, unknown> = {};
      if (!existing.plan || existing.plan === "anonymous") {
        updates.plan = planToUse;
      }
      if (existing.stdCredits === undefined) {
        updates.stdCredits = PLANS[planToUse].total;
      }
      if (existing.premiumCredits === undefined) {
        updates.premiumCredits = PLANS[planToUse].premium;
      }
      if (updates.plan || updates.stdCredits !== undefined || updates.premiumCredits !== undefined) {
        const period = PLANS[planToUse].periodMs;
        if (period && existing.refillAt === undefined) {
          updates.refillAt = Date.now() + period;
        }
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(existing._id, updates);
          return { ...existing, ...updates };
        }
      }
      return existing;
    }

    const period = PLANS[planToUse].periodMs;
    const docId = await ctx.db.insert("users", {
      userId,
      plan: planToUse,
      stdCredits: PLANS[planToUse].total,
      premiumCredits: PLANS[planToUse].premium,
      refillAt: period ? Date.now() + period : undefined,
    });
    return await ctx.db.get(docId);
  },
});

export const updateQuota = mutation({
  args: {
    userId: v.string(),
    std: v.number(),
    prem: v.number(),
    refillAt: v.optional(v.number()),
  },
  handler: async (ctx, { userId, std, prem, refillAt }) => {
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("userId"), userId))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { stdCredits: std, premiumCredits: prem, refillAt });
  },
});

export const getQuota = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("userId"), userId))
      .first();
    if (!user) return null;
    return {
      plan: user.plan ?? "anonymous",
      stdCredits: user.stdCredits ?? 0,
      premiumCredits: user.premiumCredits ?? 0,
      refillAt: user.refillAt,
    };
  },
}); 