"use client";

import { useEffect, useRef } from 'react';
import { Button } from '~/components/ui/button';
import { useFlow } from '~/lib/providers/flow-provider';
import type { Node as FlowNode } from '@xyflow/react';

interface AddBlockDropdownProps {
  isOpen: boolean;
  // Screen position relative to the Flow container; used for overlay placement
  position: { x: number; y: number } | null;
  // Flow-space position (considering pan/zoom); used for new node coordinates
  flowPosition?: { x: number; y: number } | null;
  // When provided, connects from this node id to the newly created node
  connectFromId?: string | null;
  onClose: () => void;
}

export function AddBlockDropdown({ isOpen, position, flowPosition, connectFromId, onClose }: AddBlockDropdownProps) {
  const { setNodes, setEdges } = useFlow();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  const handleAddTextNode = () => {
    const id = `text-${Date.now()}`;
    const node: FlowNode = {
      id,
      type: 'text',
      position: flowPosition || (position ?? { x: 0, y: 0 }),
      data: { title: 'Text', response: '', modelId: 'openai/gpt-4o-mini', messages: [] }
    };
    setNodes((prev) => [...prev, node]);
    if (connectFromId) {
      setEdges((prev) => [
        ...prev,
        { id: `e-${connectFromId}-${id}-${Date.now()}`, source: connectFromId, target: id, type: 'data', animated: true },
      ]);
    }
    onClose();
  };



  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-48 rounded-md border bg-popover p-2 shadow-md"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="space-y-1">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
          Add Block
        </div>

        <Button className="justify-start w-full" onClick={handleAddTextNode} size="sm" variant="ghost">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">T</div>
            <span className="text-sm">Text Node</span>
          </div>
        </Button>
        {/* Placeholder for future blocks */}
        <Button className="justify-start w-full" disabled size="sm" variant="ghost">
          <div className="flex items-center gap-3 opacity-60">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-zinc-200 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">+</div>
            <span className="text-sm">More blocks coming soon</span>
          </div>
        </Button>
      </div>
    </div>
  );
}
