import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createFlow = mutation({
  args: { userId: v.string(), name: v.string() },
  handler: async (ctx, { userId, name }) => {
    const identity = await ctx.auth.getUserIdentity();
    const actualUserId = identity?.subject || userId;
    const id = await ctx.db.insert("flows", { userId: actualUserId, name, createdAt: Date.now() });
    return id;
  },
});

export const upsertFlowNode = mutation({
  args: {
    flowId: v.id("flows"),
    nodeId: v.optional(v.string()),
    type: v.string(),
    position: v.object({ x: v.number(), y: v.number() }),
    dataJson: v.string(),
  },
  handler: async (ctx, { flowId, nodeId, type, position, dataJson }) => {
    if (nodeId) {
      await ctx.db.patch(nodeId as unknown as any, { type, position, dataJson });
      return nodeId;
    }
    const id = await ctx.db.insert("flowNodes", { flowId, type, position, dataJson, createdAt: Date.now() });
    return id;
  },
});

export const upsertFlowEdge = mutation({
  args: {
    flowId: v.id("flows"),
    edgeId: v.optional(v.string()),
    source: v.string(),
    target: v.string(),
    sourceHandle: v.optional(v.string()),
    targetHandle: v.optional(v.string()),
    dataJson: v.optional(v.string()),
  },
  handler: async (ctx, { flowId, edgeId, source, target, sourceHandle, targetHandle, dataJson }) => {
    if (edgeId) {
      await ctx.db.patch(edgeId as unknown as any, { source, target, sourceHandle, targetHandle, dataJson });
      return edgeId;
    }
    const id = await ctx.db.insert("flowEdges", { flowId, source, target, sourceHandle, targetHandle, dataJson, createdAt: Date.now() });
    return id;
  },
});

export const listFlows = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const actualUserId = identity?.subject || userId;
    return await ctx.db
      .query("flows")
      .withIndex("by_user", (q) => q.eq("userId", actualUserId))
      .order("desc")
      .collect();
  },
});
