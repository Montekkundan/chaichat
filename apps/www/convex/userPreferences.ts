import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const setTheme = mutation({
  args: { theme: v.string() },
  handler: async (ctx, { theme }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject;

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { theme });
    } else {
      await ctx.db.insert("users", { userId, theme });
    }
  },
});

export const getTheme = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    return user?.theme ?? null;
  },
});

export const setPreferredModels = mutation({
  args: { modelIds: v.array(v.string()) },
  handler: async (ctx, { modelIds }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, { preferredModels: modelIds });
    } else {
      await ctx.db.insert("users", { userId, preferredModels: modelIds });
    }
  },
});

export const getPreferredModels = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    return user?.preferredModels ?? null;
  },
}); 