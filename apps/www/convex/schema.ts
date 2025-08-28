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
    llmGatewayApiKey: v.optional(v.string()),
    aiGatewayApiKey: v.optional(v.string()),
    uploadThingApiKey: v.optional(v.string()),
    vercelBlobApiKey: v.optional(v.string()),

    // User preferences
    theme: v.optional(v.string()),
    preferredModels: v.optional(v.array(v.string())),
    storageProvider: v.optional(v.union(v.literal("uploadthing"), v.literal("vercelblob"))),
    imageGenerationModel: v.optional(v.string()), // Preferred model for image generation
  }),
  messages: defineTable({
    chatId: v.id("chats"),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    partsJson: v.optional(v.string()),
    model: v.string(),
    gateway: v.optional(
      v.union(v.literal("llm-gateway"), v.literal("vercel-ai-gateway")),
    ),
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
  // Playground entities (separate from normal chats)
  playgrounds: defineTable({
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    columns: v.array(
      v.object({
        id: v.string(),
        modelId: v.string(),
        gatewaySource: v.optional(v.union(v.literal("aigateway"), v.literal("llmgateway"))),
      }),
    ),
  }).index("by_user", ["userId"]),
  playgroundMessages: defineTable({
    playgroundId: v.id("playgrounds"),
    columnId: v.string(),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.string(),
    gateway: v.optional(
      v.union(v.literal("llm-gateway"), v.literal("vercel-ai-gateway")),
    ),
    createdAt: v.number(),
  }).index("by_playground", ["playgroundId"]).index("by_user", ["userId"]),
  // Flow graphs
  flows: defineTable({
    userId: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  flowNodes: defineTable({
    flowId: v.id("flows"),
    type: v.string(),
    position: v.object({ x: v.number(), y: v.number() }),
    dataJson: v.string(),
    createdAt: v.number(),
  }).index("by_flow", ["flowId"]),
  flowEdges: defineTable({
    flowId: v.id("flows"),
    source: v.string(),
    target: v.string(),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
    dataJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_flow", ["flowId"]),
});
