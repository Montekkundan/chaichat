import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chats: defineTable({
    name: v.string(),
    userId: v.string(),
    initialModel: v.string(), // Model used when chat was created
    currentModel: v.string(),  // Current model being used
    createdAt: v.number(),
    parentChatId: v.optional(v.id("chats")), // branch parent
    isPublic: v.optional(v.boolean()),
  }),
  users: defineTable({
    userId: v.string(),            // Clerk userId

    // BYOK keys - stored in plaintext
    openaiKey: v.optional(v.string()),
    anthropicKey: v.optional(v.string()),
    googleKey: v.optional(v.string()),
    mistralKey: v.optional(v.string()),
    xaiKey: v.optional(v.string()),
    perplexityKey: v.optional(v.string()),
    deepinfraKey: v.optional(v.string()),
    deepseekKey: v.optional(v.string()),
    groqKey: v.optional(v.string()),
    huggingfaceKey: v.optional(v.string()),
    requestyKey: v.optional(v.string()),
    githubKey: v.optional(v.string()),
    inferenceKey: v.optional(v.string()),
    togetherKey: v.optional(v.string()),
    awsKey: v.optional(v.string()),
    openrouterKey: v.optional(v.string()),
    alibabaKey: v.optional(v.string()),
    fireworksKey: v.optional(v.string()),
    veniceKey: v.optional(v.string()),
    llamaKey: v.optional(v.string()),
    morphKey: v.optional(v.string()),
    vercelKey: v.optional(v.string()),
    upstageKey: v.optional(v.string()),
    v0Key: v.optional(v.string()),
    azureKey: v.optional(v.string()),
    wandbKey: v.optional(v.string()),
    exaKey: v.optional(v.string()),
    firecrawlKey: v.optional(v.string()),

    // User preferences
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
    attachments: v.optional(
      v.array(
        v.object({
          name: v.string(),
          url: v.string(),
          contentType: v.string(),
          size: v.number(),
        }),
      ),
    ),
  }).index("by_chat", ["chatId"])
    .index("by_user", ["userId"])
    .index("by_parent", ["parentMessageId"])
    .index("by_chat_active_time", ["chatId", "isActive"]),
});
