"use client";

import { useMemo } from "react";
import { parseProviderAndModel } from "~/app/api/chat/utils";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

// Import types from the API utils
import type {
	AnthropicConfig,
	GoogleConfig,
	OpenAIConfig,
} from "~/app/api/chat/utils";

export type UnifiedConfigValue = {
	// General model config
	temperature: number;
	maxOutputTokens: number;
	topP: number;
	topK: number;
	frequencyPenalty: number;
	presencePenalty: number;
	// Provider-specific options
	openai?: OpenAIConfig;
	google?: GoogleConfig;
	anthropic?: AnthropicConfig;
};

type UnifiedConfigPanelProps = {
	modelId: string;
	value: UnifiedConfigValue;
	onChange: (update: Partial<UnifiedConfigValue>) => void;
	gateway?: "llm-gateway" | "vercel-ai-gateway";
};

export function UnifiedConfigPanel({
	modelId,
	value,
	onChange,
	gateway,
}: UnifiedConfigPanelProps) {
	const { providerId } = parseProviderAndModel(modelId);
	const rootProvider = providerId || modelId.split("/")[0];

	// Provider detection with comprehensive patterns
	const isOpenAI = useMemo(
		() => /^(openai|azure-openai|openai-chat)$/i.test(rootProvider ?? ""),
		[rootProvider],
	);
	const isGoogle = useMemo(
		() =>
			/^(google|gemini|google-ai-studio|google-generative-ai)$/i.test(
				rootProvider ?? "",
			),
		[rootProvider],
	);
	const isAnthropic = useMemo(
		() => /^(anthropic|anthropic-claude)$/i.test(rootProvider ?? ""),
		[rootProvider],
	);
	const isReasoningModel = useMemo(() => {
		const { modelName } = parseProviderAndModel(modelId);
		return (
			isOpenAI &&
			(modelName === "o1" ||
				modelName.startsWith("o1-") ||
				modelName === "o3" ||
				modelName.startsWith("o3-") ||
				modelName === "gpt-5" ||
				modelName.startsWith("gpt-5") ||
				modelName === "o4-mini" ||
				modelName.startsWith("o4-mini-"))
		);
	}, [modelId, isOpenAI]);

	return (
		<div className="space-y-4 p-2">
			{/* Gateway Information */}
			{gateway && (
				<div className="text-muted-foreground text-xs">
					Gateway:{" "}
					{gateway === "vercel-ai-gateway"
						? "Vercel AI Gateway"
						: "LLM Gateway"}
				</div>
			)}

			{/* General Model Configuration */}
			<div className="space-y-4">
				<div className="font-semibold text-sm">Model Configuration</div>
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
								onChange({
									temperature: Number.parseFloat(e.target.value) || 0,
								})
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
			</div>

			{/* OpenAI Provider Options */}
			{isOpenAI && (
				<>
					<Separator />
					<div className="space-y-4">
						<div className="font-semibold text-sm">OpenAI Options</div>
						<div className="grid grid-cols-2 gap-3">
							{/* Reasoning Effort - for o-series models */}
							{isReasoningModel && (
								<div className="space-y-1.5">
									<Label htmlFor="reasoningEffort" className="text-xs">
										Reasoning effort
									</Label>
									<select
										id="reasoningEffort"
										className="h-8 w-full rounded-md border bg-background px-2 text-sm"
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
									>
										<option value="">Default</option>
										<option value="minimal">Minimal</option>
										<option value="low">Low</option>
										<option value="medium">Medium</option>
										<option value="high">High</option>
									</select>
								</div>
							)}

							{/* Reasoning Summary - for o-series models */}
							{isReasoningModel && (
								<div className="space-y-1.5">
									<Label htmlFor="reasoningSummary" className="text-xs">
										Reasoning summary
									</Label>
									<select
										id="reasoningSummary"
										className="h-8 w-full rounded-md border bg-background px-2 text-sm"
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
									>
										<option value="">Default</option>
										<option value="auto">Auto</option>
										<option value="detailed">Detailed</option>
									</select>
								</div>
							)}

							{/* Text Verbosity - for o-series models */}
							{isReasoningModel && (
								<div className="space-y-1.5">
									<Label htmlFor="textVerbosity" className="text-xs">
										Text verbosity
									</Label>
									<select
										id="textVerbosity"
										className="h-8 w-full rounded-md border bg-background px-2 text-sm"
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
									>
										<option value="">Default</option>
										<option value="low">Low</option>
										<option value="medium">Medium</option>
										<option value="high">High</option>
									</select>
								</div>
							)}

							{/* Service Tier */}
							<div className="space-y-1.5">
								<Label htmlFor="serviceTier" className="text-xs">
									Service tier
								</Label>
								<select
									id="serviceTier"
									className="h-8 w-full rounded-md border bg-background px-2 text-sm"
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
								>
									<option value="">Default</option>
									<option value="auto">Auto</option>
									<option value="flex">Flex</option>
									<option value="priority">Priority</option>
								</select>
							</div>

							{/* Max Completion Tokens */}
							<div className="space-y-1.5">
								<Label htmlFor="maxCompletionTokens" className="text-xs">
									Max completion tokens
								</Label>
								<Input
									id="maxCompletionTokens"
									type="number"
									min="1"
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
									placeholder="Default"
								/>
							</div>

							{/* OpenAI User */}
							<div className="space-y-1.5">
								<Label htmlFor="openaiUser" className="text-xs">
									User ID
								</Label>
								<Input
									id="openaiUser"
									placeholder="user identifier"
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

							{/* Boolean options */}
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
										onChange({
											openai: { ...value.openai, store: checked },
										})
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

							{/* Metadata */}
							<div className="col-span-2 space-y-1.5">
								<Label htmlFor="metadata" className="text-xs">
									Metadata (key:value per line)
								</Label>
								<Textarea
									id="metadata"
									rows={2}
									className="h-[60px] w-full rounded-md border bg-background p-2 text-xs"
									placeholder="key1:value1&#10;key2:value2"
									value={
										value.openai?.metadata
											? Object.entries(value.openai.metadata)
													.map(([k, v]) => `${k}:${v}`)
													.join("\n")
											: ""
									}
									onChange={(e) => {
										const lines = e.target.value
											.split(/\n+/)
											.map((l) => l.trim())
											.filter(Boolean);
										const metadata: Record<string, string> = {};
										for (const line of lines) {
											const [key, ...valueParts] = line.split(":");
											if (key && valueParts.length > 0) {
												metadata[key.trim()] = valueParts.join(":").trim();
											}
										}
										onChange({
											openai: {
												...value.openai,
												metadata:
													Object.keys(metadata).length > 0
														? metadata
														: undefined,
											},
										});
									}}
								/>
							</div>
						</div>
					</div>
				</>
			)}

			{/* Google Provider Options */}
			{isGoogle && (
				<>
					<Separator />
					<div className="space-y-4">
						<div className="font-semibold text-sm">Google Options</div>
						<div className="grid grid-cols-2 gap-3">
							{/* Cached Content */}
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

							{/* Response Modalities */}
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

							{/* Safety Settings */}
							<div className="col-span-2 space-y-1.5">
								<Label htmlFor="safetySettings" className="text-xs">
									Safety settings (category:threshold per line)
								</Label>
								<Textarea
									id="safetySettings"
									rows={3}
									className="h-[84px] w-full rounded-md border bg-background p-2 text-xs"
									placeholder={
										"HARM_CATEGORY_HATE_SPEECH:BLOCK_LOW_AND_ABOVE&#10;HARM_CATEGORY_DANGEROUS_CONTENT:BLOCK_ONLY_HIGH"
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

							{/* Thinking Budget */}
							<div className="space-y-1.5">
								<Label htmlFor="thinkingBudget" className="text-xs">
									Thinking budget
								</Label>
								<Input
									id="thinkingBudget"
									type="number"
									min="0"
									step="0.001"
									value={value.google?.thinkingConfig?.thinkingBudget ?? ""}
									onChange={(e) =>
										onChange({
											google: {
												...value.google,
												thinkingConfig: {
													...value.google?.thinkingConfig,
													thinkingBudget:
														Number.parseFloat(e.target.value) || undefined,
												},
											},
										})
									}
									className="h-8"
									placeholder="0.001"
								/>
							</div>

							{/* Boolean options */}
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

							<div className="col-span-2 flex items-center justify-between">
								<div className="text-xs">Include thoughts</div>
								<Switch
									checked={Boolean(
										value.google?.thinkingConfig?.includeThoughts,
									)}
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
					</div>
				</>
			)}

			{/* Anthropic Provider Options */}
			{isAnthropic && (
				<>
					<Separator />
					<div className="space-y-4">
						<div className="font-semibold text-sm">Anthropic Options</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="anthropicThinkingBudget" className="text-xs">
									Thinking budget
								</Label>
								<Input
									id="anthropicThinkingBudget"
									type="number"
									min="0"
									step="0.001"
									value={value.anthropic?.thinkingBudget ?? ""}
									onChange={(e) =>
										onChange({
											anthropic: {
												...value.anthropic,
												thinkingBudget:
													Number.parseFloat(e.target.value) || undefined,
											},
										})
									}
									className="h-8"
									placeholder="0.001"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="anthropicMaxTokens" className="text-xs">
									Max tokens
								</Label>
								<Input
									id="anthropicMaxTokens"
									type="number"
									min="1"
									value={value.anthropic?.maxTokens ?? ""}
									onChange={(e) =>
										onChange({
											anthropic: {
												...value.anthropic,
												maxTokens: Number.parseInt(e.target.value) || undefined,
											},
										})
									}
									className="h-8"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="anthropicTemperature" className="text-xs">
									Temperature
								</Label>
								<Input
									id="anthropicTemperature"
									type="number"
									min="0"
									max="1"
									step="0.01"
									value={value.anthropic?.temperature ?? ""}
									onChange={(e) =>
										onChange({
											anthropic: {
												...value.anthropic,
												temperature:
													Number.parseFloat(e.target.value) || undefined,
											},
										})
									}
									className="h-8"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="anthropicTopP" className="text-xs">
									Top P
								</Label>
								<Input
									id="anthropicTopP"
									type="number"
									min="0"
									max="1"
									step="0.01"
									value={value.anthropic?.topP ?? ""}
									onChange={(e) =>
										onChange({
											anthropic: {
												...value.anthropic,
												topP: Number.parseFloat(e.target.value) || undefined,
											},
										})
									}
									className="h-8"
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="anthropicTopK" className="text-xs">
									Top K
								</Label>
								<Input
									id="anthropicTopK"
									type="number"
									min="1"
									value={value.anthropic?.topK ?? ""}
									onChange={(e) =>
										onChange({
											anthropic: {
												...value.anthropic,
												topK: Number.parseInt(e.target.value) || undefined,
											},
										})
									}
									className="h-8"
								/>
							</div>
						</div>
					</div>
				</>
			)}

			{/* No provider-specific options */}
			{!isOpenAI && !isGoogle && !isAnthropic && (
				<div className="py-4 text-center text-muted-foreground text-sm">
					<div>
						No provider-specific options available for{" "}
						<code className="rounded bg-muted px-1 text-xs">
							{rootProvider}
						</code>
					</div>
					<div className="mt-1 text-xs opacity-75">
						Provider detection: OpenAI={isOpenAI}, Google={isGoogle}, Anthropic=
						{isAnthropic}
					</div>
				</div>
			)}
		</div>
	);
}
