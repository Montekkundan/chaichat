"use client";

import { useMemo } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import type { ChatColumn } from "~/lib/providers/playground-provider";

// TODO: move in components folder
type ModelConfigValue = ChatColumn["config"];

export function ModelConfigPanel({
	modelId,
	value,
	onChange,
}: {
	modelId: string;
	value: ModelConfigValue;
	onChange: (update: Partial<ModelConfigValue>) => void;
}) {
	const isOpenAI = useMemo(
		() => /(^|\/)openai(\/|$)/i.test(modelId),
		[modelId],
	);
	const isGoogle = useMemo(
		() => /(^|\/)(google|gemini)(\/|$)/i.test(modelId),
		[modelId],
	);

	return (
		<div className="space-y-4 p-2">
			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1.5">
					<Label htmlFor="temperature" className="text-xs">
						Temperature
					</Label>
					<Input
						id="temperature"
						type="number"
						step="0.1"
						min="0"
						max="2"
						autoFocus
						data-autofocus
						value={value.temperature}
						onChange={(e) =>
							onChange({ temperature: Number.parseFloat(e.target.value) || 0 })
						}
						className="h-8"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="maxOutputTokens" className="text-xs">
						Max output tokens
					</Label>
					<Input
						id="maxOutputTokens"
						type="number"
						value={value.maxOutputTokens}
						onChange={(e) =>
							onChange({
								maxOutputTokens: Number.parseInt(e.target.value) || 0,
							})
						}
						className="h-8"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="topP" className="text-xs">
						topP
					</Label>
					<Input
						id="topP"
						type="number"
						step="0.05"
						min="0"
						max="1"
						value={value.topP}
						onChange={(e) =>
							onChange({ topP: Number.parseFloat(e.target.value) || 0 })
						}
						className="h-8"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="topK" className="text-xs">
						topK
					</Label>
					<Input
						id="topK"
						type="number"
						value={value.topK}
						onChange={(e) =>
							onChange({ topK: Number.parseInt(e.target.value) || 0 })
						}
						className="h-8"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="frequencyPenalty" className="text-xs">
						Frequency penalty
					</Label>
					<Input
						id="frequencyPenalty"
						type="number"
						step="0.1"
						min="0"
						max="2"
						value={value.frequencyPenalty}
						onChange={(e) =>
							onChange({
								frequencyPenalty: Number.parseFloat(e.target.value) || 0,
							})
						}
						className="h-8"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="presencePenalty" className="text-xs">
						Presence penalty
					</Label>
					<Input
						id="presencePenalty"
						type="number"
						step="0.1"
						min="0"
						max="2"
						value={value.presencePenalty}
						onChange={(e) =>
							onChange({
								presencePenalty: Number.parseFloat(e.target.value) || 0,
							})
						}
						className="h-8"
					/>
				</div>
			</div>

			{isOpenAI && (
				<>
					<Separator />
					<div className="font-semibold text-xs">OpenAI Options</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="reasoningEffort" className="text-xs">
								Reasoning effort
							</Label>
							<Input
								id="reasoningEffort"
								placeholder="minimal | low | medium | high"
								value={value.openai?.reasoningEffort ?? ""}
								onChange={(e) =>
									onChange({
										openai: {
											...value.openai,
											reasoningEffort: (e.target.value || undefined) as
												| "minimal"
												| "low"
												| "medium"
												| "high"
												| undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="reasoningSummary" className="text-xs">
								Reasoning summary
							</Label>
							<Input
								id="reasoningSummary"
								placeholder="auto | detailed"
								value={value.openai?.reasoningSummary ?? ""}
								onChange={(e) =>
									onChange({
										openai: {
											...value.openai,
											reasoningSummary: (e.target.value || undefined) as
												| "auto"
												| "detailed"
												| undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="textVerbosity" className="text-xs">
								Text verbosity
							</Label>
							<Input
								id="textVerbosity"
								placeholder="low | medium | high"
								value={value.openai?.textVerbosity ?? ""}
								onChange={(e) =>
									onChange({
										openai: {
											...value.openai,
											textVerbosity: (e.target.value || undefined) as
												| "low"
												| "medium"
												| "high"
												| undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="serviceTier" className="text-xs">
								Service tier
							</Label>
							<Input
								id="serviceTier"
								placeholder="auto | flex | priority"
								value={value.openai?.serviceTier ?? ""}
								onChange={(e) =>
									onChange({
										openai: {
											...value.openai,
											serviceTier: (e.target.value || undefined) as
												| "auto"
												| "flex"
												| "priority"
												| undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="col-span-2 flex items-center justify-between">
							<div className="text-xs">Parallel tool calls</div>
							<Switch
								checked={Boolean(value.openai?.parallelToolCalls)}
								onCheckedChange={(checked) =>
									onChange({
										openai: { ...value.openai, parallelToolCalls: checked },
									})
								}
							/>
						</div>
						<div className="col-span-2 flex items-center justify-between">
							<div className="text-xs">Store response</div>
							<Switch
								checked={Boolean(value.openai?.store)}
								onCheckedChange={(checked) =>
									onChange({ openai: { ...value.openai, store: checked } })
								}
							/>
						</div>
						<div className="col-span-2 flex items-center justify-between">
							<div className="text-xs">Strict JSON schema</div>
							<Switch
								checked={Boolean(value.openai?.strictJsonSchema)}
								onCheckedChange={(checked) =>

									onChange({
										openai: { ...value.openai, strictJsonSchema: checked },
									})
								}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="maxCompletionTokens" className="text-xs">
								Max completion tokens
							</Label>
							<Input
								id="maxCompletionTokens"
								type="number"
								value={value.openai?.maxCompletionTokens ?? ""}
								onChange={(e) =>
									onChange({
										openai: {
											...value.openai,
											maxCompletionTokens:
												Number.parseInt(e.target.value) || undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="openaiUser" className="text-xs">
								OpenAI user
							</Label>
							<Input
								id="openaiUser"
								placeholder="user id"
								value={value.openai?.user ?? ""}
								onChange={(e) =>
									onChange({
										openai: {
											...value.openai,
											user: e.target.value || undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
					</div>
				</>
			)}

			{isGoogle && (
				<>
					<Separator />
					<div className="font-semibold text-xs">Google Options</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="col-span-2 space-y-1.5">
							<Label htmlFor="cachedContent" className="text-xs">
								Cached content
							</Label>
							<Input
								id="cachedContent"
								placeholder="cachedContents/XYZ"
								value={value.google?.cachedContent ?? ""}
								onChange={(e) =>
									onChange({
										google: {
											...value.google,
											cachedContent: e.target.value || undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="col-span-2 flex items-center justify-between">
							<div className="text-xs">Structured outputs</div>
							<Switch
								checked={Boolean(value.google?.structuredOutputs)}
								onCheckedChange={(checked) =>
									onChange({
										google: { ...value.google, structuredOutputs: checked },
									})
								}
							/>
						</div>
						<div className="col-span-2 space-y-1.5">
							<Label htmlFor="responseModalities" className="text-xs">
								Response modalities
							</Label>
							<Input
								id="responseModalities"
								placeholder="TEXT, IMAGE"
								value={(value.google?.responseModalities ?? []).join(", ")}
								onChange={(e) =>
									onChange({
										google: {
											...value.google,
											responseModalities: e.target.value
												? e.target.value.split(/\s*,\s*/)
												: undefined,
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="col-span-2 space-y-1.5">
							<Label htmlFor="safetySettings" className="text-xs">
								Safety settings (category:threshold per line)
							</Label>
							<textarea
								id="safetySettings"
								rows={3}
								className="h-[84px] w-full rounded-md border bg-background p-2 text-xs"
								placeholder={
									"HARM_CATEGORY_HATE_SPEECH:BLOCK_LOW_AND_ABOVE\nHARM_CATEGORY_DANGEROUS_CONTENT:BLOCK_ONLY_HIGH"
								}
								value={(value.google?.safetySettings ?? [])
									.map((s) => `${s.category}:${s.threshold}`)
									.join("\n")}
								onChange={(e) => {
									const lines = e.target.value
										.split(/\n+/)
										.map((l) => l.trim())
										.filter(Boolean);
									const parsed = lines.map((line) => {
										const [category, threshold] = line.split(":");
										return {
											category: category?.trim() ?? "",
											threshold: threshold?.trim() ?? "",
										};
									});
									onChange({
										google: {
											...value.google,
											safetySettings: parsed.length ? parsed : undefined,
										},
									});
								}}
							/>
						</div>
						<div className="col-span-2 space-y-1.5">
							<Label htmlFor="thinkingBudget" className="text-xs">
								Thinking budget
							</Label>
							<Input
								id="thinkingBudget"
								type="number"
								value={value.google?.thinkingConfig?.thinkingBudget ?? ""}
								onChange={(e) =>
							onChange({
										google: {
											...value.google,
											thinkingConfig: {
												...value.google?.thinkingConfig,
												thinkingBudget:
													Number.parseInt(e.target.value) || undefined,
											},
										},
									})
								}
								className="h-8"
							/>
						</div>
						<div className="col-span-2 flex items-center justify-between">
							<div className="text-xs">Include thoughts</div>
							<Switch
								checked={Boolean(value.google?.thinkingConfig?.includeThoughts)}
								onCheckedChange={(checked) =>
							onChange({
										google: {
											...value.google,
											thinkingConfig: {
												...value.google?.thinkingConfig,
												includeThoughts: checked,
											},
										},
									})
								}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	);
}


