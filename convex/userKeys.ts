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
      v.literal("xai"),
      v.literal("perplexity"),
      v.literal("deepinfra"),
      v.literal("deepseek"),
      v.literal("groq"),
      v.literal("huggingface"),
      v.literal("requesty"),
      v.literal("github"),
      v.literal("inference"),
      v.literal("together"),
      v.literal("aws"),
      v.literal("openrouter"),
      v.literal("alibaba"),
      v.literal("fireworks"),
      v.literal("venice"),
      v.literal("llama"),
      v.literal("morph"),
      v.literal("vercel"),
      v.literal("upstage"),
      v.literal("v0"),
      v.literal("azure"),
      v.literal("wandb"),
      v.literal("exa"),
      v.literal("firecrawl")
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
      perplexityKey: user.perplexityKey,
      deepinfraKey: user.deepinfraKey,
      deepseekKey: user.deepseekKey,
      groqKey: user.groqKey,
      huggingfaceKey: user.huggingfaceKey,
      requestyKey: user.requestyKey,
      githubKey: user.githubKey,
      inferenceKey: user.inferenceKey,
      togetherKey: user.togetherKey,
      awsKey: user.awsKey,
      openrouterKey: user.openrouterKey,
      alibabaKey: user.alibabaKey,
      fireworksKey: user.fireworksKey,
      veniceKey: user.veniceKey,
      llamaKey: user.llamaKey,
      morphKey: user.morphKey,
      vercelKey: user.vercelKey,
      upstageKey: user.upstageKey,
      v0Key: user.v0Key,
      azureKey: user.azureKey,
      exaKey: user.exaKey,
      firecrawlKey: user.firecrawlKey,
      wandbKey: user.wandbKey,
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
      v.literal("xai"),
      v.literal("perplexity"),
      v.literal("deepinfra"),
      v.literal("deepseek"),
      v.literal("groq"),
      v.literal("huggingface"),
      v.literal("requesty"),
      v.literal("github"),
      v.literal("inference"),
      v.literal("together"),
      v.literal("aws"),
      v.literal("openrouter"),
      v.literal("alibaba"),
      v.literal("fireworks"),
      v.literal("venice"),
      v.literal("llama"),
      v.literal("morph"),
      v.literal("vercel"),
      v.literal("upstage"),
      v.literal("v0"),
      v.literal("azure"),
      v.literal("wandb"),
      v.literal("exa"),
      v.literal("firecrawl")
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
      perplexityKey: user.perplexityKey,
      deepinfraKey: user.deepinfraKey,
      deepseekKey: user.deepseekKey,
      groqKey: user.groqKey,
      huggingfaceKey: user.huggingfaceKey,
      requestyKey: user.requestyKey,
      githubKey: user.githubKey,
      inferenceKey: user.inferenceKey,
      togetherKey: user.togetherKey,
      awsKey: user.awsKey,
      openrouterKey: user.openrouterKey,
      alibabaKey: user.alibabaKey,
      fireworksKey: user.fireworksKey,
      veniceKey: user.veniceKey,
      llamaKey: user.llamaKey,
      morphKey: user.morphKey,
      vercelKey: user.vercelKey,
      upstageKey: user.upstageKey,
      v0Key: user.v0Key,
      azureKey: user.azureKey,
      exaKey: user.exaKey,
      firecrawlKey: user.firecrawlKey,
      wandbKey: user.wandbKey,
    };
  },
}); 