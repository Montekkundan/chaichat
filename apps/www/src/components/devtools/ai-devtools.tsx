"use client";

import { AIDevtools } from "ai-sdk-devtools";

type Props = {
  enabled?: boolean; // defaults to true in all envs
  modelId?: string;
  endpoint?: string;
  position?: "bottom" | "right" | "overlay";
  height?: number;
};

export function DevtoolsOverlay({
  enabled = true,
  modelId,
  endpoint = "/api/chat",
  position = "bottom",
  height = 360,
}: Props) {
  if (enabled === false) return null;

  return (
    <AIDevtools
      enabled={enabled}
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
