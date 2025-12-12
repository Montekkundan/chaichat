"use client";

import { useCallback } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useFlow } from '~/lib/providers/flow-provider';
import { BaseNode, BaseNodeHeader, BaseNodeHeaderTitle, BaseNodeContent, BaseNodeFooter } from '../base-node';
import { NodeAppendix } from '../node-appendix';
import { LabeledHandle } from '../labeled-handle';
import { ModelSelector } from '~/components/chat-input/model-selector';
import { Position } from '@xyflow/react';

type NumNodeData = { value: number; title?: string };

export function NumNode({ id, data }: NodeProps) {
  const { setNodes } = useFlow();

  const updateNodeData = useCallback((nodeId: string, newData: Partial<NumNodeData>) => {
    setNodes((prevNodes) => {
      if (!Array.isArray(prevNodes)) {
        console.error('prevNodes is not an array:', prevNodes);
        return [];
      }
      return prevNodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      );
    });
  }, [setNodes]);

  const d = (data as NumNodeData) ?? { value: 0 };

  const increment = () => {
    updateNodeData(id, { value: (d.value ?? 0) + 1 });
  };

  const decrement = () => {
    updateNodeData(id, { value: Math.max(0, (d.value ?? 0) - 1) });
  };

  return (
    <BaseNode className="w-64">
      <BaseNodeHeader>
        <BaseNodeHeaderTitle>{d.title ?? 'Number'}</BaseNodeHeaderTitle>
        <div className="flex gap-1">
          <button
            className="border hover:bg-accent inline-flex h-6 w-6 items-center justify-center rounded text-xs"
            onClick={decrement}
            type="button"
          >
            −
          </button>
          <button
            className="border hover:bg-accent inline-flex h-6 w-6 items-center justify-center rounded text-xs"
            onClick={increment}
            type="button"
          >
            +
          </button>
        </div>
      </BaseNodeHeader>
      <BaseNodeContent>
        <div className="text-muted-foreground text-sm">Value</div>
        <div className="rounded-md border bg-background p-2 text-sm font-mono">
          {(d.value ?? 0).toString()}
        </div>
      </BaseNodeContent>
      <BaseNodeFooter>
        <LabeledHandle id="in" type="target" position={Position.Left} title="in" />
        <LabeledHandle id="out" type="source" position={Position.Right} title="out" />
        <NodeAppendix position="bottom">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Model</span>
            <ModelSelector selectedModelId="openai/gpt-4o-mini" setSelectedModelId={() => {}} />
          </div>
        </NodeAppendix>
      </BaseNodeFooter>
    </BaseNode>
  );
}
