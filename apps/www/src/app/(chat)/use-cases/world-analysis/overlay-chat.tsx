"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { getAllKeys } from "~/lib/local-keys";
import { ModelSelector } from "~/components/chat-input/model-selector";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { Play, Pause, PaperPlaneTilt, TrashSimple } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { Loader } from "~/components/ai-elements/loader";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

type OverlayPoint = { lat: number; lon: number; value?: number; color?: string; size?: number; label?: string };

type ToolResultBase = {
  type: string;
};

type PointsToolResult = ToolResultBase & {
  type: 'points';
  intent?: string;
  points: OverlayPoint[];
  legend?: { title?: string; min?: number; max?: number; units?: string };
};

type CameraToolResult = ToolResultBase & {
  type: 'camera';
  lat: number;
  lon: number;
  radius?: number;
};

type RotationToolResult = ToolResultBase & {
  type: 'rotation';
  running?: boolean;
  speed?: number;
};

type BarsToolResult = ToolResultBase & {
  type: 'bars';
  intent?: string;
  bars: Array<{ lat: number; lon: number; value?: number; height?: number; color?: string; radius?: number; label?: string }>;
  legend?: { title?: string; min?: number; max?: number; units?: string };
  scaling?: { min?: number; max?: number };
};

type ShaderToolResult = ToolResultBase & {
  type: 'shader';
  sun?: { phi?: number; theta?: number };
  atmosphereDayColor?: string;
  atmosphereTwilightColor?: string;
  overlayOffset?: { lonDeg?: number; latDeg?: number };
};

type GeoToolResult = ToolResultBase & {
  type: 'geo';
  intent?: string;
  countryCodes?: string[];
  countryNames?: string[];
  geojsonUrl?: string;
  geojson?: unknown;
  style?: {
    showBorders?: boolean;
    borderColor?: string;
    borderWidth?: number;
    fillColor?: string;
    fillOpacity?: number;
    maskOthers?: boolean;
    plainColor?: string;
  };
};

type TextureToolResult = ToolResultBase & {
  type: 'texture';
  mode: 'day' | 'night' | 'paleo' | 'custom';
  url?: string;
};

type ClearToolResult = ToolResultBase & { type: 'clear' };
type CountryMetricToolResult = ToolResultBase & {
  type: 'country-metric';
  intent?: string;
  metricName?: string;
  items: Array<{ code: string; value: number; color?: string; radius?: number }>;
  legend?: { title?: string; min?: number; max?: number; units?: string };
  scaling?: { min?: number; max?: number };
};

type ToolResult = PointsToolResult | CameraToolResult | RotationToolResult | BarsToolResult | ShaderToolResult | GeoToolResult | TextureToolResult | ClearToolResult | CountryMetricToolResult;

export type OverlayChatProps = {
  className?: string;
  isUserAuthenticated: boolean;
  onOverlayPoints?: (payload: { intent?: string; points: OverlayPoint[]; legend?: { title?: string; min?: number; max?: number; units?: string } }) => void;
  onSetCamera?: (payload: { lat: number; lon: number; radius?: number }) => void;
  onOverlayBars?: (payload: { intent?: string; bars: Array<{ lat: number; lon: number; value?: number; height?: number; color?: string; radius?: number; label?: string }>; legend?: { title?: string; min?: number; max?: number; units?: string }; scaling?: { min?: number; max?: number } }) => void;
  onSetShader?: (payload: { sun?: { phi?: number; theta?: number }; atmosphereDayColor?: string; atmosphereTwilightColor?: string; overlayOffset?: { lonDeg?: number; latDeg?: number } }) => void;
  onOverlayGeo?: (payload: GeoToolResult) => void;
  onSetBaseMap?: (payload: TextureToolResult) => void;
};

export function OverlayChat({ className, isUserAuthenticated, onOverlayPoints, onSetCamera, onOverlayBars, onSetShader, onOverlayGeo, onSetBaseMap }: OverlayChatProps) {
  const [selectedModel, setSelectedModel] = useState<string>("openai/gpt-4o-mini");
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState<boolean>(true);

  const apiPath = "/api/world-analysis";

  const { messages, status, stop, sendMessage } = useChat({
    // Use the same transport as the main chat to pass keys and gateway
    transport: new DefaultChatTransport({
      api: apiPath,
      body: async () => {
        const gateway = (() => {
          try {
            const src = window.localStorage.getItem("chaichat_models_source");
            return src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway";
          } catch {
            return "llm-gateway" as const;
          }
        })();
        const userApiKeys = await getAllKeys();
        return {
          model: selectedModel,
          gateway,
          userApiKeys,
        };
    },
    // biome-ignore lint/suspicious/noExplicitAny: transport type mismatch across versions
    }) as any,
    onFinish: ({ message }) => {
      try {
        const parts = message?.parts || [];
        const payloads: ToolResult[] = [];
        const collect = (value: unknown): void => {
          if (!value || typeof value !== 'object') return;
          const obj = value as Record<string, unknown>;
          if (typeof obj.type === 'string' && ['points','camera','rotation','bars','shader','geo','texture'].includes(obj.type)) {
            payloads.push(obj as ToolResult);
          }
          for (const k of Object.keys(obj)) {
            // biome-ignore lint/suspicious/noExplicitAny: safe traversal of tool result shapes
            const v: any = (obj as any)[k];
            collect(v);
          }
        };
        for (const p of parts) collect(p);
        for (const toolResult of payloads) {
          if (toolResult.type === 'points') {
            const { intent, points, legend } = toolResult;
            if (Array.isArray(points) && onOverlayPoints) onOverlayPoints({ intent, points, legend });
          } else if (toolResult.type === 'camera') {
            const { lat, lon, radius } = toolResult;
            if (typeof lat === 'number' && typeof lon === 'number' && onSetCamera) onSetCamera({ lat, lon, radius });
          } else if (toolResult.type === 'rotation') {
            const { running, speed } = toolResult;
            window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running, speed } }));
          } else if (toolResult.type === 'bars') {
            const { intent, bars, legend, scaling } = toolResult;
            if (Array.isArray(bars) && onOverlayBars) onOverlayBars({ intent, bars, legend, scaling });
          } else if (toolResult.type === 'shader') {
            if (onSetShader) onSetShader(toolResult);
          } else if (toolResult.type === 'geo') {
            try {
              // Clear previous overlays on new region highlight and pause rotation
              window.dispatchEvent(new CustomEvent('world-clear-overlays'))
              window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running: false } }))
            } catch {}
            onOverlayGeo?.(toolResult);
          } else if (toolResult.type === 'texture') {
            onSetBaseMap?.(toolResult);
          } else if (toolResult.type === 'clear') {
            try { window.dispatchEvent(new CustomEvent('world-clear-overlays')); } catch {}
          } else if (toolResult.type === 'country-metric') {
            try { window.dispatchEvent(new CustomEvent('world-country-metric', { detail: toolResult })); } catch {}
          }
        }
      } catch {}
    },
  });

  // Fallback: scan all messages for tool results and apply side effects once
  const seenToolsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    try {
      for (const m of messages) {
        const parts = m?.parts || [];
        for (const p of parts) {
          // Attempt to read a tool result shape regardless of part typings
          if (typeof p === "object" && p && 'type' in p && (p.type === "tool-result" || 'toolResult' in p)) {
            const part = p as Record<string, unknown>;
            const out = part.result ?? part.output ?? part.toolResult ?? null;
            if (!out || typeof out !== 'object' || !('type' in out)) continue;
            const key = JSON.stringify(out);
            if (seenToolsRef.current.has(key)) continue;
            seenToolsRef.current.add(key);
            const toolResult = out as ToolResult;
            if (toolResult.type === 'points' && Array.isArray(toolResult.points) && onOverlayPoints) {
              onOverlayPoints({ intent: toolResult.intent, points: toolResult.points, legend: toolResult.legend });
            } else if (toolResult.type === 'camera' && typeof toolResult.lat === 'number' && onSetCamera) {
              onSetCamera({ lat: toolResult.lat, lon: toolResult.lon, radius: toolResult.radius });
              // Pause rotation on camera focus for clarity; AI can resume via rotation tool.
              window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running: false } }));
            } else if (toolResult.type === 'rotation') {
              window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running: toolResult.running, speed: toolResult.speed } }));
            } else if (toolResult.type === 'bars' && Array.isArray(toolResult.bars) && onOverlayBars) {
              onOverlayBars({ intent: toolResult.intent, bars: toolResult.bars, legend: toolResult.legend, scaling: toolResult.scaling });
            } else if (toolResult.type === 'shader' && onSetShader) {
              onSetShader(toolResult);
            } else if (toolResult.type === 'geo') {
              onOverlayGeo?.(toolResult);
            } else if (toolResult.type === 'texture') {
              onSetBaseMap?.(toolResult);
            }
          }
        }
      }
    } catch {}
  }, [messages, onOverlayPoints, onSetCamera, onOverlayBars, onSetShader, onOverlayGeo, onSetBaseMap]);

  // Send handler
  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    // Clear previous overlays for a fresh request when the new prompt is not an obvious follow-up
    const isFollowUp = /^(and|also|then|continue|now)\b/i.test(text) || /\badd\b|\boverlay\b|\bresume\b/i.test(text)
    if (!isFollowUp) {
      try { window.dispatchEvent(new CustomEvent('world-clear-overlays')); } catch {}
    }
    seenToolsRef.current.clear();
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text }],
    });
    setInput("");
  };

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn("pointer-events-auto w-full max-w-2xl bg-background/80 backdrop-blur border rounded-xl shadow-lg", className)}
    >
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-2">
          <ModelSelector selectedModelId={selectedModel} setSelectedModelId={setSelectedModel} isUserAuthenticated={isUserAuthenticated} />
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running: true, speed: 0.1 } }))}>
                <Play size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resume rotation</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('world-rotation-update', { detail: { running: false } }))}>
                <Pause size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pause rotation</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent('world-clear-overlays')) } catch {}
                }}
              >
                <TrashSimple size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear overlays</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)}>{expanded ? 'Collapse' : 'Expand'}</Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="chat-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden px-3 pb-3"
          >
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the world-analysis agent (bars, points, rotate Earth, adjust sun)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); }
                  }}
                  className="pr-9"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {status === "streaming" || status === "submitted" ? (
                    <Loader size={12} />
                  ) : (
                    <button
                      type="button"
                      aria-label="Send"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => void onSend()}
                      disabled={!input.trim()}
                    >
                      <PaperPlaneTilt size={16} />
                    </button>
                  )}
                </div>
              </div>
              {status === "streaming" && (
                <Button size="sm" variant="secondary" onClick={stop}>Stop</Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
