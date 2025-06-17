"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { RECOMMENDED_MODEL_IDS } from "~/lib/config";
import { useModels } from "~/lib/providers/models-provider";
import OpenAIIcon from "~/components/icons/openai";
import GeminiIcon from "~/components/icons/gemini";
import ClaudeIcon from "~/components/icons/claude";
import MistralIcon from "~/components/icons/mistral";
import GrokIcon from "~/components/icons/grok";
import { Button } from "~/components/ui/button";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
	openai: OpenAIIcon,
	gemini: GeminiIcon,
	google: GeminiIcon,
	claude: ClaudeIcon,
	anthropic: ClaudeIcon,
	mistral: MistralIcon,
	grok: GrokIcon,
};

export default function ModelsPage() {
	const preferred = useQuery(api.userPreferences.getPreferredModels, {}) as
		| string[]
		| null
		| undefined;
	const savePref = useMutation(api.userPreferences.setPreferredModels);

	const {
		models,
		isLoading: modelsLoading,
		refetch: refetchModels,
	} = useModels();

	const [selected, setSelected] = useState<string[]>(RECOMMENDED_MODEL_IDS);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (preferred !== undefined && preferred !== null) {
			setSelected(preferred.length ? preferred : RECOMMENDED_MODEL_IDS);
		}
	}, [preferred]);

	if (modelsLoading || preferred === undefined) {
		return (
			<div className="flex items-center justify-center py-10">
				<Loader2 className="animate-spin" />
			</div>
		);
	}

	const handleSave = async () => {
		setSaving(true);
		try {
			const next = [...selected];
			await savePref({ modelIds: next });
			setSelected(next);
			await fetch("/api/models", { method: "POST" });
			await refetchModels();
		} finally {
			setSaving(false);
		}
	};

	const toggleModel = (id: string) => {
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
		);
	};

	const useRecommended = () => setSelected(RECOMMENDED_MODEL_IDS);
	const selectAll = () => setSelected(models.map((m) => m.id));

	return (
		<div className="mx-auto max-w-3xl px-4 py-8">
			<h1 className="mb-6 font-semibold text-2xl">Model Visibility</h1>

			<div className="mb-4 flex gap-3">
				<Button variant="secondary" size="sm" onClick={useRecommended}>
					Use recommended ({RECOMMENDED_MODEL_IDS.length})
				</Button>
				<Button variant="secondary" size="sm" onClick={selectAll}>
					Select all ({models.length})
				</Button>
			</div>

			<div className="grid gap-6 sm:grid-cols-2">
				{models.map((m) => {
					const checked = selected.includes(m.id);
					const Icon = ICON_MAP[m.providerId] ?? (() => null);
					return (
						<Button
							key={m.id}
							variant="outline"
							size="lg"
							onClick={() => toggleModel(m.id)}
							className={`relative w-full justify-start px-6 py-6 hover:bg-muted/20 text-base ${checked ? 'border-primary/70 bg-primary/5' : ''}`}
						>
							{checked && (
								<span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-white">
									<Check className="h-3 w-3" />
								</span>
							)}
							<div className="flex items-center gap-4">
								<Icon className="h-8 w-8" />
								<div>
									<div className="font-medium">{m.name}</div>
									<div className="text-xs text-muted-foreground capitalize">{m.provider}</div>
								</div>
							</div>
						</Button>
					);
				})}
			</div>

			<Button
				type="button"
				disabled={saving}
				onClick={handleSave}
				className="mt-6"
			>
				{saving ? "Saving..." : "Save preferences"}
			</Button>
		</div>
	);
}
