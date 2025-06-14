"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RECOMMENDED_MODEL_IDS } from "~/lib/config";
import { useModels } from "~/lib/providers/models-provider";

export default function ModelsPage() {
	const preferred = useQuery(api.userPreferences.getPreferredModels, {}) as
		| string[]
		| null
		| undefined;
	const savePref = useMutation(api.userPreferences.setPreferredModels);

	const { models, isLoading: modelsLoading, refetch: refetchModels } = useModels();

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
			<h1 className="mb-6 text-2xl font-semibold">Model Visibility</h1>

			<div className="mb-4 flex gap-3">
				<button
					type="button"
					onClick={useRecommended}
					className="rounded bg-secondary px-3 py-2 text-sm hover:bg-secondary/60"
				>
					Use recommended ({RECOMMENDED_MODEL_IDS.length})
				</button>
				<button
					type="button"
					onClick={selectAll}
					className="rounded bg-secondary px-3 py-2 text-sm hover:bg-secondary/60"
				>
					Select all ({models.length})
				</button>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
				{models.map((m) => (
					<label
						key={m.id}
						className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm hover:bg-muted/30"
					>
						<input
							type="checkbox"
							className="h-4 w-4"
							checked={selected.includes(m.id)}
							onChange={() => toggleModel(m.id)}
						/>
						{m.name}
					</label>
				))}
			</div>

			<button
				type="button"
				disabled={saving}
				onClick={handleSave}
				className="mt-6 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
			>
				{saving ? "Saving..." : "Save preferences"}
			</button>
		</div>
	);
}
