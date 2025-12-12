"use client";

import { addEdge, type Edge, type Node, type OnConnect } from "@xyflow/react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UIMessage } from "ai";
import { useTheme } from "next-themes";

type FlowNodeData = Record<string, unknown>;

type FlowContextType = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onConnect: OnConnect;
  colorMode: "dark" | "light";
  addTextNode: (position: { x: number; y: number }, initialText?: string) => void;
  addNumNode: (position: { x: number; y: number }, initialValue?: number) => void;
  addChildTextNode: (parentId: string) => string | null;
  getAncestorMessages: (nodeId: string) => UIMessage[];
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
};

const FlowContext = createContext<FlowContextType | null>(null);

export function useFlow() {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error("useFlow must be used inside FlowProvider");
  return ctx;
}

export function FlowProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isDragging, setIsDraggingState] = useState(false);
  const { resolvedTheme } = useTheme();

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ animated: true, ...params }, eds)),
    [],
  );

  const addTextNode = useCallback(
    (position: { x: number; y: number }, initialText = "") => {
      const id = `text-${Date.now()}`;
      const node: Node<FlowNodeData> = {
        id,
        type: "text",
        position,
        data: { title: "Text", response: initialText, modelId: "openai/gpt-4o-mini", messages: [] },
      };
      setNodes((prev) => [...prev, node]);
    },
    [],
  );

  const addNumNode = useCallback(
    (position: { x: number; y: number }, initialValue = 0) => {
      const id = `num-${Date.now()}`;
      const node: Node<FlowNodeData> = {
        id,
        type: "num",
        position,
        data: { value: initialValue, title: "Number" },
      };
      setNodes((prev) => [...prev, node]);
    },
    [],
  );

  const addChildTextNode = useCallback(
    (parentId: string) => {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return null;
      const parentData = (parent.data || {}) as { messages?: UIMessage[]; title?: string; modelId?: string };
      const newId = `text-${Date.now()}`;
      const position = {
        x: (parent.position?.x ?? 0) + 320,
        y: (parent.position?.y ?? 0),
      };
      const node: Node<FlowNodeData> = {
        id: newId,
        type: "text",
        position,
        data: {
          title: parentData.title || "Text",
          response: "",
          modelId: parentData.modelId || "openai/gpt-4o-mini",
          messages: Array.isArray(parentData.messages) ? [...parentData.messages] : [],
        },
      };
      setNodes((prev) => [...prev, node]);
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${parentId}-${newId}-${Date.now()}`,
          source: parentId,
          target: newId,
          type: "data",
        },
      ]);
      return newId;
    },
    [nodes],
  );

  const getAncestorMessages = useCallback(
    (nodeId: string): UIMessage[] => {
      // Gather upstream context ONLY from ancestors (exclude current node)
      const parentsMap = new Map<string, string[]>();
      for (const e of edges) {
        const arr = parentsMap.get(e.target) || [];
        arr.push(e.source);
        parentsMap.set(e.target, arr);
      }
      const visited = new Set<string>();
      const orderedAncestors: string[] = [];
      const traverseParents = (id: string) => {
        const parents = parentsMap.get(id) || [];
        for (const p of parents) {
          if (visited.has(p)) continue;
          visited.add(p);
          traverseParents(p);
          orderedAncestors.push(p);
        }
      };
      traverseParents(nodeId);
      const msgs: UIMessage[] = [];
      for (const ancId of orderedAncestors) {
        const n = nodes.find((nn) => nn.id === ancId);
        if (!n) continue;
        const d = (n.data || {}) as { messages?: UIMessage[] };
        if (Array.isArray(d.messages) && d.messages.length > 0) {
          msgs.push(...d.messages);
        }
      }
      return msgs;
    },
    [edges, nodes],
  );

  const colorMode = useMemo<"dark" | "light">(
    () => (resolvedTheme === "dark" ? "dark" : "light"),
    [resolvedTheme],
  );

  const value = useMemo(
    () => ({ nodes, edges, setNodes, setEdges, onConnect, colorMode, addTextNode, addNumNode, addChildTextNode, getAncestorMessages, isDragging, setIsDragging: (v: boolean) => setIsDraggingState(v) }),
    [nodes, edges, onConnect, colorMode, addTextNode, addNumNode, addChildTextNode, getAncestorMessages, isDragging],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}


