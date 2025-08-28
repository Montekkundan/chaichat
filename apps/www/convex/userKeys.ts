import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// Simplified API key storage for LLM Gateway only
// Keys are stored in plaintext for simplicity
// For non-logged users, keys will be stored in localStorage/sessionStorage

export const storeKey = mutation({
  args: {
    provider: v.union(
      v.literal("llmgateway"),
      v.literal("aigateway"),
      v.literal("uploadthing"),
      v.literal("vercelblob"),
      v.literal("storage")
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

    const updateData: any = {};

    switch (provider) {
      case "llmgateway":
        updateData.llmGatewayApiKey = apiKey;
        break;
      case "aigateway":
        updateData.aiGatewayApiKey = apiKey;
        break;
      case "uploadthing":
        updateData.uploadThingApiKey = apiKey;
        break;
      case "vercelblob":
        updateData.vercelBlobApiKey = apiKey;
        break;
      case "storage":
        updateData.storageProvider = apiKey as "uploadthing" | "vercelblob";
        break;
    }

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, updateData);
    } else {
      // Create new user record with the provided data
      await ctx.db.insert("users", { userId, ...updateData });
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

    // Return all stored keys
    return {
      llmGatewayApiKey: user.llmGatewayApiKey,
      aiGatewayApiKey: user.aiGatewayApiKey,
      uploadThingApiKey: user.uploadThingApiKey,
      vercelBlobApiKey: user.vercelBlobApiKey,
      storageProvider: user.storageProvider,
      imageGenerationModel: user.imageGenerationModel,
    };
  },
});

export const removeKey = mutation({
  args: {
    provider: v.union(
      v.literal("llmgateway"),
      v.literal("aigateway"),
      v.literal("uploadthing"),
      v.literal("vercelblob")
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
      const updateData: any = {};

      switch (provider) {
        case "llmgateway":
          updateData.llmGatewayApiKey = undefined;
          break;
        case "aigateway":
          updateData.aiGatewayApiKey = undefined;
          break;
        case "uploadthing":
          updateData.uploadThingApiKey = undefined;
          break;
        case "vercelblob":
          updateData.vercelBlobApiKey = undefined;
          break;
      }

      await ctx.db.patch(user._id, updateData);
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
      uploadThingApiKey: user.uploadThingApiKey,
      vercelBlobApiKey: user.vercelBlobApiKey,
      storageProvider: user.storageProvider,
    };
  },
});

// Set user preferences (like image generation model)
export const setUserPreference = mutation({
  args: {
    key: v.union(v.literal("imageGenerationModel")),
    value: v.string(),
  },
  handler: async (ctx, { key, value }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    const updateData: any = {};
    updateData[key] = value;

    if (user) {
      await ctx.db.patch(user._id, updateData);
    } else {
      await ctx.db.insert("users", { userId, [key]: value });
    }
  },
}); 