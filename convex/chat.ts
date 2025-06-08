import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const createChat = mutation({
  args: { name: v.string(), userId: v.string() },
  handler: async (ctx, { name, userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const actualUserId = identity?.subject || userId;
    const chatId = await ctx.db.insert("chats", {
      name,
      userId: actualUserId,
      createdAt: Date.now(),
    });
    return chatId;
  },
});

export const listChats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();
  },
});

export const addMessage = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, { chatId, userId, role, content }) => {
    await ctx.db.insert("messages", {
      chatId,
      userId,
      role,
      content,
      createdAt: Date.now(),
    });
  },
});

// Get messages for a chat (optionally filter by userId)
export const getMessages = query({
  args: { chatId: v.id("chats"), userId: v.optional(v.string()) },
  handler: async (ctx, { chatId, userId }) => {
    let query = ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .order("asc");
    if (userId) {
      query = query.filter((q) => q.eq(q.field("userId"), userId));
    }
    return await query.collect();
  },
});

// Delete a chat and all its messages
export const deleteChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    await ctx.db.delete(chatId);
  },
});
