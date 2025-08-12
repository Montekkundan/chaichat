import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createPlayground = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    columns: v.array(
      v.object({
        id: v.string(),
        modelId: v.string(),
        gatewaySource: v.optional(v.union(v.literal("aigateway"), v.literal("llmgateway"))),
      }),
    ),
  },
  handler: async (ctx, { userId, name, columns }) => {
    const identity = await ctx.auth.getUserIdentity();
    const actualUserId = identity?.subject || userId;
    const _id = await ctx.db.insert("playgrounds", {
      userId: actualUserId,
      name,
      createdAt: Date.now(),
      columns,
    });
    return _id;
  },
});

export const addPlaygroundMessage = mutation({
  args: {
    playgroundId: v.id("playgrounds"),
    columnId: v.string(),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.string(),
  },
  handler: async (ctx, { playgroundId, columnId, userId, role, content, model }) => {
    const identity = await ctx.auth.getUserIdentity();
    const actualUserId = identity?.subject || userId;
    const msgId = await ctx.db.insert("playgroundMessages", {
      playgroundId,
      columnId,
      userId: actualUserId,
      role,
      content,
      model,
      createdAt: Date.now(),
    });
    return msgId;
  },
});

export const listPlaygrounds = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const actualUserId = identity?.subject || userId;
    return await ctx.db
      .query("playgrounds")
      .withIndex("by_user", (q) => q.eq("userId", actualUserId))
      .order("desc")
      .collect();
  },
});

export const getPlaygroundMessages = query({
  args: { playgroundId: v.id("playgrounds") },
  handler: async (ctx, { playgroundId }) => {
    return await ctx.db
      .query("playgroundMessages")
      .withIndex("by_playground", (q) => q.eq("playgroundId", playgroundId))
      .order("asc")
      .collect();
  },
});


