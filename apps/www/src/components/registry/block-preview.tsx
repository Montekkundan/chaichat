"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Input } from "~/components/ui/input";

type BlockPreviewProps = {
	slug: string;
};

const componentCache = new Map<string, ComponentType<Record<string, unknown>>>();

const registryComponentImporters: Record<string, () => Promise<{ default: ComponentType<Record<string, unknown>> }>> = {
	"model-selector": () =>
		import("~/registry/blocks/model-selector/model-selector").then((m: typeof import("~/registry/blocks/model-selector/model-selector")) => ({
			default: m.ModelSelector as ComponentType<Record<string, unknown>>,
		})),
	"playground-column": () =>
		import("~/registry/blocks/playground-column/playground-column").then((m: typeof import("~/registry/blocks/playground-column/playground-column")) => ({
			default: m.default as ComponentType<Record<string, unknown>>,
		})),
};

function getDynamicBySlug(slug: string): ComponentType<Record<string, unknown>> | null {
	const cached = componentCache.get(slug);
	if (cached) {
		return cached;
	}

	const importer = registryComponentImporters[slug];
	if (!importer) {
		return null;
	}

	const DynamicComponent = dynamic(importer) as unknown as ComponentType<Record<string, unknown>>;

	componentCache.set(slug, DynamicComponent);
	return DynamicComponent;
}

export function BlockPreview({ slug }: BlockPreviewProps) {
	const Component = getDynamicBySlug(slug);
	if (!Component) {
		return null;
	}
	const [aiKey, setAiKey] = useState("");

	useEffect(() => {
		try {
			const v = window.localStorage.getItem("chaichat_registry_aigateway") || "";
			setAiKey(v);
		} catch {
			setAiKey("");
		}
	}, []);

	const showAiConfig = slug === "model-selector";
	const isPlaygroundColumn = slug === "playground-column";

	return (
		<div className="space-y-3 rounded-lg border p-4">
			{showAiConfig && (
				<div className="rounded-md border p-3">
					<div className="mb-2 font-medium text-sm">Vercel AI Gateway API key (preview)</div>
					<div className="flex items-center gap-2">
						<Input
							type="password"
							placeholder="Enter your Vercel AI Gateway API key"
							value={aiKey}
							onChange={(e) => {
								const v = e.target.value;
								setAiKey(v);
								try {
									if (v.trim()) {
										window.localStorage.setItem("chaichat_registry_aigateway", v.trim());
									} else {
										window.localStorage.removeItem("chaichat_registry_aigateway");
									}
								} catch { }
								window.dispatchEvent(new CustomEvent("apiKeysChanged"));
							}}
							className="max-w-md"
						/>
					</div>
					<p className="mt-2 text-muted-foreground text-xs">
						The model selector checks this key from localStorage. In your app you can fetch from your database instead.
					</p>
				</div>
			)}
			{isPlaygroundColumn ? (
				<div className="relative h-[500px] min-h-[500px]">
					<div className="absolute inset-0 flex min-h-0">
						<div className="flex h-full w-full min-h-0">
							<Component />
						</div>
					</div>
				</div>
			) : (
				<Component />
			)}
		</div>
	);
}


