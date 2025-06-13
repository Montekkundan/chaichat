"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";

type UserKeys = {
	openaiKey?: string;
	anthropicKey?: string;
	googleKey?: string;
	mistralKey?: string;
};

function maskKey(key: string | undefined) {
	if (!key) return "—";
	if (key.length <= 8) return "••••";
	return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export default function ApiKeysPage() {
	const userKeys = useQuery(api.userKeys.getKeys, {}) as UserKeys | undefined;
	const saveKey = useMutation(api.userKeys.saveKey);

	const [openaiInput, setOpenaiInput] = useState("");
	const [saving, setSaving] = useState(false);

	// initialise input with existing key (unmasked) when first loaded
	useEffect(() => {
		if (userKeys?.openaiKey) {
			setOpenaiInput(userKeys.openaiKey);
		}
	}, [userKeys]);

	const handleSave = async () => {
		const trimmed = openaiInput.trim();
		if (!trimmed) return;
		setSaving(true);
		try {
			await saveKey({ provider: "openai", apiKey: trimmed });
		} finally {
			setSaving(false);
		}
	};

	if (userKeys === undefined) {
		return (
			<div className="flex items-center justify-center py-10">
				<Loader2 className="animate-spin" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-md px-4 py-8">
			<h1 className="mb-6 text-2xl font-semibold">API Keys</h1>

			{/* OpenAI key section */}
			<div className="mb-8 border rounded-lg p-4">
				<h2 className="font-medium mb-2">OpenAI</h2>
				<p className="text-sm text-muted-foreground mb-4">
					Enter your personal OpenAI API key if you want to use premium models.
					It is stored encrypted and sent only when you make a request.
				</p>

				<label className="block text-sm font-medium mb-1" htmlFor="openai-key">
					Current key
				</label>
				<div className="mb-3 text-sm" id="openai-key">
					{maskKey(userKeys.openaiKey)}
				</div>

				<input
					type="text"
					className="w-full border rounded p-2 text-sm mb-3"
					placeholder="sk-..."
					value={openaiInput}
					onChange={(e) => setOpenaiInput(e.target.value)}
				/>
				<button
					type="button"
					disabled={saving || !openaiInput.trim()}
					onClick={handleSave}
					className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
				>
					{saving ? "Saving..." : "Save key"}
				</button>
			</div>
		</div>
	);
}
