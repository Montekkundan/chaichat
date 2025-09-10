"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { getAllKeys } from "~/lib/local-keys";
import { ModelSelector } from "~/components/chat-input/model-selector";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { PaperPlaneTilt, TrashSimple } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { Loader } from "~/components/ai-elements/loader";
import { Textarea } from "~/components/ui/textarea";
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
  const [showForm, setShowForm] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const OPEN_WIDTH = 600;
  const OPEN_HEIGHT = 220;
  const COLLAPSED_WIDTH = 120;

  const apiPath = "/api/world-analysis";

  const { messages, status, stop, sendMessage } = useChat({
    // Use the same transport as the main chat to pass keys and gateway
    transport: new DefaultChatTransport({
      api: apiPath,
      body: async () => {
        const gateway = (() => {
          try {
            const src = (window.localStorage.getItem("chaichat_models_source") || "").toLowerCase();
            if (src === "llmgateway" || src === "llm" || src === "gateway-llm") return "llm-gateway" as const;
            // Default to Vercel AI Gateway so tool calls work out of the box in prod
            return "vercel-ai-gateway" as const;
          } catch {
            return "vercel-ai-gateway" as const;
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
          if (typeof obj.type === 'string' && ['points','camera','rotation','bars','shader','geo','texture','clear','country-metric'].includes(obj.type)) {
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
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);
  const focusTextarea = useCallback(() => {
    const ta = textareaRef.current || (inputWrapperRef.current?.querySelector('textarea') as HTMLTextAreaElement | null);
    if (!ta) return false;
    try {
      ta.focus({ preventScroll: true });
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
      return document.activeElement === ta;
    } catch {
      return false;
    }
  }, []);

  const focusTextareaWithRetry = useCallback(() => {
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      const ok = focusTextarea();
      if (!ok && attempts < 10) setTimeout(tick, 30);
    };
    setTimeout(tick, 0);
  }, [focusTextarea]);

  // Focus when panel expands
  useEffect(() => {
    if (!showForm) return;
    focusTextareaWithRetry();
  }, [showForm, focusTextareaWithRetry]);
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

  // Close the morphing input when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (inputWrapperRef.current && !inputWrapperRef.current.contains(e.target as Node)) {
        setShowForm(false);
      }
    }
    if (showForm) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showForm]);

  // Send handler
  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    seenToolsRef.current.clear();
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text }],
    });
    setInput("");
    setShowForm(false);
  };

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(className)}
    >
      <div className="overflow-hidden px-3 pb-3">
        <motion.div
          ref={inputWrapperRef}
          data-panel
          className="relative z-20 flex flex-col items-center overflow-hidden rounded-xl border bg-background shadow-md"
          initial={false}
          animate={{ width: showForm ? OPEN_WIDTH : COLLAPSED_WIDTH, height: showForm ? OPEN_HEIGHT : 36, borderRadius: showForm ? 14 : 20 }}
          style={{ maxWidth: "min(600px, calc(100vw - 32px))" }}
          transition={{ type: "spring", stiffness: 350, damping: 35, mass: 0.7 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {!showForm ? (
              <motion.button
                key="dock"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-auto flex h-[36px] w-full cursor-pointer select-none items-center justify-center whitespace-nowrap bg-transparent"
                onClick={() => { setShowForm(true); setTimeout(() => focusTextareaWithRetry(), 0) }}
              >
                <div className="flex items-center justify-center gap-2 px-3">
                  <span className="text-xs">Talk to AI</span>
                </div>
              </motion.button>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex h-full w-full flex-col gap-2 p-2"
              >
                <div className="flex items-center justify-between">
                  <ModelSelector selectedModelId={selectedModel} setSelectedModelId={setSelectedModel} isUserAuthenticated={isUserAuthenticated} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
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
                </div>
                <div className="flex h-full items-stretch gap-2">
                  <div className="relative h-full flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      rows={4}
                      onFocus={() => setShowForm(true)}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask the world-analysis agent (bars, points, rotate Earth, adjust sun)"
                      onKeyDown={(e) => {
                        const isMetaEnter = (e.metaKey || e.ctrlKey) && e.key === "Enter";
                        const isShiftEnter = e.shiftKey && e.key === "Enter";
                        if (isMetaEnter || isShiftEnter) { e.preventDefault(); void onSend(); }
                      }}
                      className="h-full min-h-0 w-full resize-none bg-transparent pr-9 pb-9 border-0 shadow-none outline-none focus:border-transparent focus:outline-none focus-visible:border-transparent focus-visible:ring-0"
                    />
                    <div className="absolute bottom-2 right-2">
                      {status === "streaming" || status === "submitted" ? (
                        <Loader size={12} />
                      ) : (
                        <button
                          type="button"
                          aria-label="Send"
                          className="text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => void onSend()}
                          disabled={!input.trim()}
                        >
                          <PaperPlaneTilt size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  {status === "streaming" && (
                    <Button size="sm" variant="secondary" className="self-end" onClick={stop}>Stop</Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
