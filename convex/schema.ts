import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chats: defineTable({
    name: v.string(),
    userId: v.string(),
    initialModel: v.string(), // Model used when chat was created
    currentModel: v.string(),  // Current model being used
    createdAt: v.number(),
  }),
  users: defineTable({
    userId: v.string(),            // Clerk userId
    // Billing / quota
    plan: v.optional(v.union(v.literal("anonymous"), v.literal("free"), v.literal("pro"))),
    stdCredits: v.optional(v.number()),
    premiumCredits: v.optional(v.number()),
    refillAt: v.optional(v.number()),

    // BYOK keys
    openaiKey: v.optional(v.string()),
    mistralKey: v.optional(v.string()),
    googleKey: v.optional(v.string()),
    anthropicKey: v.optional(v.string()),

    // misc prefs
    theme: v.optional(v.string()),
    preferredModels: v.optional(v.array(v.string())),
  }),
  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.string(),
    createdAt: v.number(),
    parentMessageId: v.optional(v.id("messages")), // Links to the original message
    version: v.optional(v.number()), // Version number (1, 2, 3, etc.)
    isActive: v.optional(v.boolean()),
  }).index("by_chat", ["chatId"])
    .index("by_user", ["userId"])
    .index("by_parent", ["parentMessageId"])
    .index("by_chat_active_time", ["chatId", "isActive"]),
});
