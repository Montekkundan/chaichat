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
            const gw: "llm-gateway" | "vercel-ai-gateway" = gateway;
            setGatewayLabel(gw);
            return;
        }
		try {
			const src = window.localStorage.getItem("chaichat_models_source");
			setGatewayLabel(
				src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway",
			);
		} catch {}
	}, [gateway]);

    const fullLabel = (() => {
        if (!modelId || modelId.trim().length === 0) return gatewayLabel;
        return `${gatewayLabel}:${modelId}`;
    })();

    function shortenModelName(name: string): string {
        const base = name.includes("/")
            ? name.substring(name.lastIndexOf("/") + 1)
            : name;
        // Split on hyphens primarily so numeric underscore groups stay together, e.g. 3_3
        const rawTokensByHyphen: string[] = base
            .split("-")
            .filter((s): s is string => s.length > 0);

        const normalizeToken = (t: string) => {
            // turn numeric underscores into dots: 3_1 -> 3.1
            return t.replace(/(\d)_(\d)/g, "$1.$2");
        };

        const tokens: string[] = rawTokensByHyphen.map(normalizeToken);

        if (tokens.length <= 3) return tokens.join("-");

        const startTokens: string[] = [];
        const t0 = tokens[0];
        if (t0) startTokens.push(t0);
        const t1 = tokens[1];
        if (t1) startTokens.push(t1);

        const isSizeOrVersion = (t: string) =>
            /^(?:\d+(?:\.\d+)?(?:[KMB]?)B?|v\d+(?:\.\d+)?)$/i.test(t);

        const endTokens: string[] = [];
        for (let i = tokens.length - 1; i >= 0 && endTokens.length < 2; i--) {
            const t = tokens[i];
            if (!t) continue;
            if (isSizeOrVersion(t) || i === tokens.length - 1) {
                endTokens.unshift(t);
            }
        }

        const uniqueOrdered = (arr: string[]) => {
            const seen = new Set<string>();
            const out: string[] = [];
            for (const item of arr) {
                if (!seen.has(item)) {
                    seen.add(item);
                    out.push(item);
                }
            }
            return out;
        };

        const combined = uniqueOrdered([...startTokens, ...endTokens]);
        const removed = tokens.length > combined.length;

        let compact = removed && startTokens.length > 0 && endTokens.length > 0
            ? [...startTokens, "…", ...endTokens].join("-")
            : combined.join("-");

        const MAX_CHARS = 28;
        if (compact.length > MAX_CHARS) {
            const head = compact.slice(0, 18);
            const tail = compact.slice(-8);
            compact = `${head}…${tail}`;
        }
        return compact;
    }

    const displayLabel = (() => {
        if (!modelId || modelId.trim().length === 0) return gatewayLabel;
        const cleaned = modelId.trim();
        const shortened = shortenModelName(cleaned);
        return `${gatewayLabel}:${shortened}`;
    })();

    return (
        <Badge
            variant="outline"
            className="max-w-[220px] md:max-w-[300px] text-xs truncate"
            title={fullLabel}
            aria-label={fullLabel}
        >
            {displayLabel}
        </Badge>
    );
}

export default ModelBadge;
