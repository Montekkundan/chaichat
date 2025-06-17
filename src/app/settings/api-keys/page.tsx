"use client";

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";

type UserKeys = {
	openaiKey?: string;
	anthropicKey?: string;
	googleKey?: string;
	mistralKey?: string;
	xaiKey?: string;
};

type ProviderId = "openai" | "anthropic" | "google" | "mistral";

function maskKey(key: string | undefined) {
	if (!key) return "—";
	if (key.length <= 8) return "••••";
	return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export default function ApiKeysPage() {
	const getKeys = useAction(api.userKeys.getKeys);
	const saveKey = useAction(api.userKeys.saveKey);

	const [userKeys, setUserKeys] = useState<UserKeys | undefined>(undefined);

	const [openaiInput, setOpenaiInput] = useState("");
	const [anthropicInput, setAnthropicInput] = useState("");
	const [googleInput, setGoogleInput] = useState("");
	const [mistralInput, setMistralInput] = useState("");
	const [saving, setSaving] = useState(false);

	// Fetch keys on mount
	useEffect(() => {
		(async () => {
			const result = (await getKeys({})) as UserKeys;
			setUserKeys(result);
		})();
	}, [getKeys]);

	const handleSaveProvider = async (provider: ProviderId, value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return;
		setSaving(true);
		try {
			await saveKey({ provider, apiKey: trimmed });
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
			<h1 className="mb-6 font-semibold text-2xl">API Keys</h1>

			{/* Provider key sections */}
			{(
				[
					{
						label: "OpenAI",
						state: openaiInput,
						set: setOpenaiInput,
						key: userKeys.openaiKey,
						provider: "openai" as const,
					},
					{
						label: "Anthropic",
						state: anthropicInput,
						set: setAnthropicInput,
						key: userKeys.anthropicKey,
						provider: "anthropic" as const,
					},
					{
						label: "Google",
						state: googleInput,
						set: setGoogleInput,
						key: userKeys.googleKey,
						provider: "google" as const,
					},
					{
						label: "Mistral",
						state: mistralInput,
						set: setMistralInput,
						key: userKeys.mistralKey,
						provider: "mistral" as const,
					},
				] as const
			).map((p) => (
				<div key={p.provider} className="mb-8 rounded-lg border p-4">
					<h2 className="mb-2 font-medium">{p.label}</h2>
					<p className="mb-4 text-muted-foreground text-sm">
						Provide your {p.label} API key if you plan to use premium models
						from {p.label}.
					</p>
					<p className="mb-1 block font-medium text-sm">Current key</p>
					<div className="mb-3 text-sm">{maskKey(p.key)}</div>
					<input
						type="password"
						className="mb-3 w-full rounded border p-2 text-sm"
						placeholder="••••••"
						value={p.state}
						onChange={(e) => p.set(e.target.value)}
					/>
					<Button
						disabled={saving || !p.state.trim()}
						onClick={() => handleSaveProvider(p.provider, p.state)}
					>
						{saving ? "Saving..." : "Save key"}
					</Button>
				</div>
			))}
		</div>
	);
}
