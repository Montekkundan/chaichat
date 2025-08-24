"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Edge,
  type Node,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlow } from '~/lib/providers/flow-provider';
import { DataEdge } from './data-edge';
import { NumNode, TextNode } from './nodes';
import { AddBlockDropdown } from './add-block-dropdown';
import { ZoomSlider } from './zoom-slider';

const nodeTypes: NodeTypes = { num: NumNode, text: TextNode };
const edgeTypes: EdgeTypes = { data: DataEdge };

const initialNodes: Node[] = [
  {
    id: 'text-1',
    type: 'text',
    position: { x: 100, y: 100 },
    data: { title: 'Text Node', response: '', modelId: 'openai/gpt-4o-mini' }
  },
];

const initialEdges: Edge[] = [];

export function FlowCanvas() {
  const { colorMode, nodes, edges, setNodes, setEdges, setIsDragging } = useFlow();
  const [mounted, setMounted] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addPos, setAddPos] = useState<{ x: number; y: number } | null>(null);
  const [addFlowPos, setAddFlowPos] = useState<{ x: number; y: number } | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const rf = useReactFlow();
  const connectSucceededRef = useRef(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges],
  );

  const handleConnect: OnConnect = useCallback(
    (params) => {
      connectSucceededRef.current = true;
      setEdges((eds) => addEdge({ animated: true, type: 'data', ...params }, eds));
    },
    [setEdges],
  );

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const containerBounds = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const screenPos = { x: e.clientX - containerBounds.left, y: e.clientY - containerBounds.top };
    const flowPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setAddPos(screenPos);
    setAddFlowPos(flowPos);
    setConnectingFromId(null);
    setIsAddOpen(true);
  }, [rf]);

  // Seed provider nodes with initial node so updates propagate correctly
  useEffect(() => {
    if (nodes.length === 0) {
      setNodes(initialNodes);
    }
  }, [nodes.length, setNodes]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Allow nodes to request opening the AddBlockDropdown via a window event
  useEffect(() => {
    const handler = (evt: Event) => {
      const e = evt as CustomEvent<{ clientX: number; clientY: number; sourceId?: string | null }>;
      const { clientX, clientY, sourceId } = e.detail || { clientX: 0, clientY: 0, sourceId: null };
      const flowPos = rf.screenToFlowPosition({ x: clientX, y: clientY });
      const containerBounds = (document.querySelector('.react-flow') as HTMLDivElement | null)?.getBoundingClientRect();
      const screenPos = containerBounds ? { x: clientX - containerBounds.left, y: clientY - containerBounds.top } : { x: clientX, y: clientY };
      setAddPos(screenPos);
      setAddFlowPos(flowPos);
      if (typeof sourceId === 'string' && sourceId.length > 0) {
        setConnectingFromId(sourceId);
      }
      setIsAddOpen(true);
    };
    window.addEventListener('flow:add-dropdown', handler as EventListener);
    return () => window.removeEventListener('flow:add-dropdown', handler as EventListener);
  }, [rf]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges.length > 0 ? edges : initialEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onPaneClick={() => setIsAddOpen(false)}
        onNodeDragStart={() => { setIsAddOpen(false); setIsDragging(true); }}
        onNodeDragStop={() => setIsDragging(false)}
        onConnectStart={(_, params) => {
          setIsAddOpen(false);
          connectSucceededRef.current = false;
          setConnectingFromId(params?.nodeId || null);
        }}
        onConnectEnd={(event) => {
          setIsAddOpen(false);
          const srcId = connectingFromId;
          setConnectingFromId(null);
          // If onConnect did not fire (no target), open dropdown at drop position
          if (!connectSucceededRef.current && srcId) {
            const { clientX, clientY } = event as MouseEvent;
            const flowPos = rf.screenToFlowPosition({ x: clientX, y: clientY });
            const containerBounds = (document.querySelector('.react-flow') as HTMLDivElement | null)?.getBoundingClientRect();
            const screenPos = containerBounds ? { x: clientX - containerBounds.left, y: clientY - containerBounds.top } : { x: clientX, y: clientY };
            setAddPos(screenPos);
            setAddFlowPos(flowPos);
            // preserve source for dropdown creation
            setConnectingFromId(srcId);
            setIsAddOpen(true);
          }
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={mounted ? colorMode : undefined}
        fitView={false}
        zoomOnDoubleClick={false}
        onDoubleClick={handleDoubleClick}
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          className="bg-muted/20"
        />
        <MiniMap position="bottom-right" zoomable pannable />
        <ZoomSlider position="bottom-center" className="m-2" />
      </ReactFlow>

      <AddBlockDropdown
        isOpen={isAddOpen}
        position={addPos}
        flowPosition={addFlowPos}
        connectFromId={connectingFromId}
        onClose={() => setIsAddOpen(false)}
      />
    </div>
  );
}
