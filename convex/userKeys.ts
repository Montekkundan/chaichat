import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// --- AWS KMS INTEGRATION ----------------------------------------------------
// Convex has AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, KMS_KEY_ID

import {
  KMSClient,
  EncryptCommand,
  DecryptCommand,
} from "@aws-sdk/client-kms";

const awsRegion = process.env.AWS_REGION;
const kmsKeyId = process.env.KMS_KEY_ID;
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!awsRegion || !kmsKeyId || !awsAccessKeyId || !awsSecretAccessKey) {
  throw new Error(
    "AWS KMS env vars missing – ensure AWS_REGION, KMS_KEY_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are set in Convex deployment",
  );
}

const kmsClient = new KMSClient({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
});

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }
  // Fallback: custom base64 encoder
  return Buffer.from(bytes).toString("base64");
}

function base64ToUint8(b64: string): Uint8Array {
  if (typeof atob !== "undefined") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Fallback using Buffer if available
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function kmsEncrypt(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const res = await kmsClient.send(
    new EncryptCommand({
      KeyId: kmsKeyId,
      Plaintext: textEncoder.encode(plaintext),
    }),
  );
  if (!res.CiphertextBlob) throw new Error("KMS encryption failed");
  return uint8ToBase64(res.CiphertextBlob as Uint8Array);
}

async function kmsDecrypt(ciphertextB64: string): Promise<string> {
  if (!ciphertextB64) return "";
  const res = await kmsClient.send(
    new DecryptCommand({
      CiphertextBlob: base64ToUint8(ciphertextB64),
    }),
  );
  if (!res.Plaintext) throw new Error("KMS decryption failed");
  return textDecoder.decode(res.Plaintext as Uint8Array);
}

export const storeEncryptedKey = mutation({
  args: {
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral")
    ),
    encryptedKey: v.string(),
  },
  handler: async (ctx, { provider, encryptedKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
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

export const getUserDoc = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
  },
});

// Action exposed to clients: performs encryption then writes using internal mutation
export const saveKey = action({
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
    const encryptedKey = await kmsEncrypt(apiKey);
    await ctx.runMutation("userKeys:storeEncryptedKey" as any, {
      provider,
      encryptedKey,
    });
  },
});

export const getKeys = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {};
    }

    const userId = identity.subject;
    const user = await ctx.runQuery("userKeys:getUserDoc" as any, { userId });

    if (!user) {
      return {};
    }

    // Decrypt each key 
    return {
      openaiKey: user.openaiKey ? await kmsDecrypt(user.openaiKey) : undefined,
      anthropicKey: user.anthropicKey ? await kmsDecrypt(user.anthropicKey) : undefined,
      googleKey: user.googleKey ? await kmsDecrypt(user.googleKey) : undefined,
      mistralKey: user.mistralKey ? await kmsDecrypt(user.mistralKey) : undefined,
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

// Server-side:get decrypted keys for API calls
export const getUserKeysForAPI = action({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery("userKeys:getUserDoc" as any, { userId });

    if (!user) {
      return {};
    }

    return {
      openaiKey: user.openaiKey ? await kmsDecrypt(user.openaiKey) : undefined,
      anthropicKey: user.anthropicKey ? await kmsDecrypt(user.anthropicKey) : undefined,
      googleKey: user.googleKey ? await kmsDecrypt(user.googleKey) : undefined,
      mistralKey: user.mistralKey ? await kmsDecrypt(user.mistralKey) : undefined,
    };
  },
}); 