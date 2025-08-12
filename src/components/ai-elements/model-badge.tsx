"use client";

import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";

export function ModelBadge({
  modelId,
  gateway,
}: {
  modelId?: string;
  gateway?: "llm-gateway" | "vercel-ai-gateway";
}) {
  const [gatewayLabel, setGatewayLabel] = useState<string>("llm-gateway");

  useEffect(() => {
    if (gateway === "llm-gateway" || gateway === "vercel-ai-gateway") {
      setGatewayLabel(gateway);
      return;
    }
    try {
      const src = window.localStorage.getItem("chaichat_models_source");
      setGatewayLabel(src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway");
    } catch {}
  }, [gateway]);

  const label = (() => {
    if (!modelId || modelId.trim().length === 0) return gatewayLabel;
    return `${gatewayLabel}:${modelId}`;
  })();

  return (
    <Badge variant="outline" className="text-xs">
      {label}
    </Badge>
  );
}

export default ModelBadge;


