import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple encryption/decryption using base64 + salt (for demo purposes)
// TODO In production, consider using a proper encryption service like AWS KMS
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "chaichat-default-key-2024";

function simpleEncrypt(text: string): string {
  if (!text) return "";
  // Simple XOR encryption with base64 encoding
  const bytes = Buffer.from(text, 'utf8');
  const encrypted = Array.from(bytes).map((byte, i) => 
    byte ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
  );
  return Buffer.from(encrypted).toString('base64');
}

function simpleDecrypt(encrypted: string): string {
  if (!encrypted) return "";
  try {
    const bytes = Buffer.from(encrypted, 'base64');
    const decrypted = Array.from(bytes).map((byte, i) => 
      byte ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    );
    return Buffer.from(decrypted).toString('utf8');
  } catch {
    return ""; // Return empty string if decryption fails
  }
}

export const saveKey = mutation({
  args: {
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral")
    ),
    apiKey: v.string(),
  },
  handler: async (ctx, { provider, apiKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const encryptedKey = simpleEncrypt(apiKey);
    
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        [`${provider}Key`]: encryptedKey,
      });
    } else {
      // Create new user record
      await ctx.db.insert("users", {
        userId,
        [`${provider}Key`]: encryptedKey,
      });
    }
  },
});

export const getKeys = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {};
    }

    const userId = identity.subject;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!user) {
      return {};
    }

    // Return decrypted keys
    return {
      openaiKey: user.openaiKey ? simpleDecrypt(user.openaiKey) : undefined,
      anthropicKey: user.anthropicKey ? simpleDecrypt(user.anthropicKey) : undefined,
      googleKey: user.googleKey ? simpleDecrypt(user.googleKey) : undefined,
      mistralKey: user.mistralKey ? simpleDecrypt(user.mistralKey) : undefined,
    };
  },
});

export const removeKey = mutation({
  args: {
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral")
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

// Server-side helper to get decrypted keys for API calls
export const getUserKeysForAPI = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (!user) {
      return {};
    }

    // Return decrypted keys for server use
    return {
      openaiKey: user.openaiKey ? simpleDecrypt(user.openaiKey) : undefined,
      anthropicKey: user.anthropicKey ? simpleDecrypt(user.anthropicKey) : undefined,
      googleKey: user.googleKey ? simpleDecrypt(user.googleKey) : undefined,
      mistralKey: user.mistralKey ? simpleDecrypt(user.mistralKey) : undefined,
    };
  },
}); 