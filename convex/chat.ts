import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const createChat = mutation({
  args: { name: v.string(), userId: v.string(), model: v.string() },
  handler: async (ctx, { name, userId, model }) => {
    const identity = await ctx.auth.getUserIdentity();
    const actualUserId = identity?.subject || userId;
    const chatId = await ctx.db.insert("chats", {
      name,
      userId: actualUserId,
      initialModel: model,
      currentModel: model,
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
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    model: v.string(),
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
    parentMessageId: v.optional(v.id("messages")),
    version: v.optional(v.number()),
  },
  handler: async (ctx, { chatId, userId, role, content, model, attachments, parentMessageId, version }) => {
    const messageId = await ctx.db.insert("messages", {
      chatId,
      userId,
      role,
      content,
      model,
      attachments,
      createdAt: Date.now(),
      parentMessageId,
      version,
      isActive: true, // New messages are active by default
    });

    // If this is a regenerated message (has parentMessageId), deactivate other versions
    if (parentMessageId) {
      const otherVersions = await ctx.db
        .query("messages")
        .withIndex("by_parent", (q) => q.eq("parentMessageId", parentMessageId))
        .filter((q) => q.neq(q.field("_id"), messageId))
        .collect();
      
      for (const otherVersion of otherVersions) {
        await ctx.db.patch(otherVersion._id, { isActive: false });
      }
      
      // Also deactivate the parent message if it exists
      await ctx.db.patch(parentMessageId, { isActive: false });
    }

    return messageId;
  },
});

// Get messages for a chat (optionally filter by userId) - only active versions
export const getMessages = query({
  args: { chatId: v.id("chats"), userId: v.optional(v.string()) },
  handler: async (ctx, { chatId, userId }) => {
    let query = ctx.db
      .query("messages")
      .withIndex("by_chat_active_time", (q) =>
        q.eq("chatId", chatId).eq("isActive", true)
      )
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
    // Delete all messages for this chat
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", chatId))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    // Now delete the chat itself
    await ctx.db.delete(chatId);
  },
});

export const searchChats = query({
  args: { userId: v.string(), query: v.string() },
  handler: async (ctx, { userId, query }) => {
    const lowerQuery = query.toLowerCase();
    const chats = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    return chats.filter((chat) =>
      chat.name.toLowerCase().includes(lowerQuery)
    );
  },
});

export const updateChatModel = mutation({
  args: { chatId: v.id("chats"), model: v.string() },
  handler: async (ctx, { chatId, model }) => {
    await ctx.db.patch(chatId, {
      currentModel: model,
    });
  },
});

// Get all versions of a message
export const getMessageVersions = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) return [];

    const parentId = message.parentMessageId || messageId;
    
    // Get the original message and all its versions
    const versions = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentMessageId", parentId))
      .collect();
    
    // Include the original message if it exists
    const originalMessage = await ctx.db.get(parentId);
    if (originalMessage) {
      versions.unshift(originalMessage);
    }

    return versions.sort((a, b) => (a.version || 1) - (b.version || 1));
  },
});

// Switch active version of a message
export const switchMessageVersion = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) return;

    const parentId = message.parentMessageId || messageId;
    
    // Deactivate all versions
    const allVersions = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentMessageId", parentId))
      .collect();
    
    for (const version of allVersions) {
      await ctx.db.patch(version._id, { isActive: false });
    }
    
    // Deactivate the original if it exists
    const originalMessage = await ctx.db.get(parentId);
    if (originalMessage) {
      await ctx.db.patch(parentId, { isActive: false });
    }

    // Activate the selected version
    await ctx.db.patch(messageId, { isActive: true });

    // Return the new active list (sorted)
    const chatId = message.chatId;
    const active = await ctx.db
      .query("messages")
      .withIndex("by_chat_active_time", q => q.eq("chatId", chatId).eq("isActive", true))
      .order("asc")
      .collect();

    return active;
  },
});

// Get next version number for a message
export const getNextVersionNumber = query({
  args: { parentMessageId: v.id("messages") },
  handler: async (ctx, { parentMessageId }) => {
    // Get all versions (children of the parent)
    const versions = await ctx.db
      .query("messages")
      .withIndex("by_parent", (q) => q.eq("parentMessageId", parentMessageId))
      .collect();
    
    // Also get the original message (the parent itself)
    const originalMessage = await ctx.db.get(parentMessageId);
    
    // Collect all version numbers, including the original
    const versionNumbers = versions.map(v => v.version || 1);
    if (originalMessage) {
      versionNumbers.push(originalMessage.version || 1);
    }
    
    // Find the maximum version and add 1
    const maxVersion = Math.max(...versionNumbers, 0);
    return maxVersion + 1;
  },
});

// Mark original message as version 1 when it gets its first regeneration
export const markAsOriginalVersion = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    await ctx.db.patch(messageId, {
      version: 1,
      isActive: false, // The new regenerated version will be active
    });
  },
});
