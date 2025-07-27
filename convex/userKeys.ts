import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// Simplified API key storage for logged-in users only
// Keys are stored in plaintext since we removed expensive AWS KMS
// For non-logged users, keys will be stored in localStorage/sessionStorage

export const storeKey = mutation({
  args: {
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral"),
      v.literal("xai")
    ),
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
      await ctx.db.patch(existingUser._id, {
        [`${provider}Key`]: apiKey,
      });
    } else {
      // Create new user record
      await ctx.db.insert("users", {
        userId,
        [`${provider}Key`]: apiKey,
      });
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

    // Return keys directly (no decryption needed)
    return {
      openaiKey: user.openaiKey,
      anthropicKey: user.anthropicKey,
      googleKey: user.googleKey,
      mistralKey: user.mistralKey,
      xaiKey: user.xaiKey,
    };
  },
});

export const removeKey = mutation({
  args: {
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral"),
      v.literal("xai")
    ),
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
      await ctx.db.patch(user._id, {
        [`${provider}Key`]: undefined,
      });
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
      openaiKey: user.openaiKey,
      anthropicKey: user.anthropicKey,
      googleKey: user.googleKey,
      mistralKey: user.mistralKey,
      xaiKey: user.xaiKey,
    };
  },
}); 