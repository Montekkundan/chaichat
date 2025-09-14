"use client";

import { AIDevtools } from "ai-sdk-devtools";

type Props = {
  enabled?: boolean;
  modelId?: string;
  endpoint?: string;
  position?: "bottom" | "right" | "overlay";
  height?: number;
};

export function DevtoolsOverlay({
  enabled,
  modelId,
  endpoint = "/api/chat",
  position = "bottom",
  height = 360,
}: Props) {
  const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";
  if (enabled === false) return null;
  if (!isDev && enabled !== true) return null;

  return (
    <AIDevtools
      modelId={modelId}
      config={{
        position,
        height,
        streamCapture: {
          enabled: true,
          endpoint,
          autoConnect: true,
        },
        throttle: {
          enabled: true,
          interval: 100,
          includeTypes: ["text-delta"],
        },
      }}
      debug={false}
    />
  );
}

