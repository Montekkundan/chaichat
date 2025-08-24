"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";

type BlockPreviewProps = {
	slug: string;
};

// Known previews for stability; falls back to convention.
const PREVIEW_MAP: Record<string, ComponentType<Record<string, unknown>>> = {
	"model-selector": dynamic(() =>
		import("~/registry/blocks/model-selector/model-selector").then(
			(m: Record<string, unknown>) =>
				(((m as { default?: unknown }).default || (m as Record<string, unknown>).ModelSelector) as ComponentType<Record<string, unknown>>),
		),
	) as unknown as ComponentType<Record<string, unknown>>,
	"playground-column": dynamic(() =>
		import("~/registry/blocks/playground-column/playground-column").then(
			(m: Record<string, unknown>) =>
				(((m as { default?: unknown }).default || (m as Record<string, unknown>).PlaygroundColumn) as ComponentType<Record<string, unknown>>),
		),
	) as unknown as ComponentType<Record<string, unknown>>,
};

// Only use an explicit map to avoid wildcard dynamic imports pulling in non-code files (e.g., README.md)
function getDynamicBySlug(slug: string): ComponentType<Record<string, unknown>> | null {
    return PREVIEW_MAP[slug] || null;
}

// no-op helper reserved for future explicit mappings

export function BlockPreview({ slug }: BlockPreviewProps) {
	const Component = getDynamicBySlug(slug);
	if (!Component) {
		return null;
	}
	return (
		<div className="rounded-lg border p-4">
			<Component />
		</div>
	);
}


