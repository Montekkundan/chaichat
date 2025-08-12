import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// Simplified API key storage for LLM Gateway only
// Keys are stored in plaintext for simplicity
// For non-logged users, keys will be stored in localStorage/sessionStorage

export const storeKey = mutation({
  args: {
    provider: v.union(v.literal("llmgateway"), v.literal("aigateway")),
    apiKey: v.string(),
  },
  handler: async (ctx, { provider, apiKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated - use local storage for non-logged users");
    }

    const userId = identity.subject;
    
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existingUser) {
      // Update existing user
      if (provider === "llmgateway") {
        await ctx.db.patch(existingUser._id, { llmGatewayApiKey: apiKey });
      } else {
        await ctx.db.patch(existingUser._id, { aiGatewayApiKey: apiKey });
      }
    } else {
      // Create new user record
      if (provider === "llmgateway") {
        await ctx.db.insert("users", { userId, llmGatewayApiKey: apiKey });
      } else {
        await ctx.db.insert("users", { userId, aiGatewayApiKey: apiKey });
      }
    }
  },
});

export const getUserDoc = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
  },
});

export const getKeys = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {}; // Non-logged users should use localStorage
    }

    const userId = identity.subject;
    const user = await ctx.runQuery("userKeys:getUserDoc" as any, { userId });

    if (!user) {
      return {};
    }

    // Return BYOK keys
    return {
      llmGatewayApiKey: user.llmGatewayApiKey,
      aiGatewayApiKey: user.aiGatewayApiKey,
    };
  },
});

export const removeKey = mutation({
  args: {
    provider: v.union(v.literal("llmgateway"), v.literal("aigateway")),
  },
  handler: async (ctx, { provider }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (user) {
      if (provider === "llmgateway") {
        await ctx.db.patch(user._id, { llmGatewayApiKey: undefined });
      } else {
        await ctx.db.patch(user._id, { aiGatewayApiKey: undefined });
      }
    }
  },
});

// Server-side: get keys for API calls (for logged-in users)
export const getUserKeysForAPI = action({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery("userKeys:getUserDoc" as any, { userId });

    if (!user) {
      return {};
    }

    return {
      llmGatewayApiKey: user.llmGatewayApiKey,
      aiGatewayApiKey: user.aiGatewayApiKey,
    };
  },
}); 