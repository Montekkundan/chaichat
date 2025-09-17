"use client";

import type { LLMGatewayModel } from "~/types/llmgateway";

interface ColumnEmptyStateProps {
	modelId?: string | null;
	selectedModel?: LLMGatewayModel;
	selectedProviderLabel?: string;
	isModelsLoading: boolean;
	modelsError?: string | null;
	promptPrice?: string;
	completionPrice?: string;
}

export function ColumnEmptyState({
	modelId,
	selectedModel,
	selectedProviderLabel,
	isModelsLoading,
	modelsError,
	promptPrice,
	completionPrice,
}: ColumnEmptyStateProps) {
	return (
		<div className="flex size-full items-center justify-center px-4">
			<div className="w-full max-w-xl rounded-lg border bg-white shadow-xs dark:bg-black">
				<div className="p-5 text-sm">
					<div className="flex items-center gap-2">
						<div className="space-x-1">
							<span className="font-medium text-zinc-800 dark:text-zinc-200">
								{selectedModel?.name ?? modelId}
							</span>
							{selectedProviderLabel && (
								<span className="text-zinc-600 dark:text-zinc-400">· {selectedProviderLabel}</span>
							)}
						</div>
					</div>

					{isModelsLoading ? (
						<div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Loading model details…</div>
					) : modelsError ? (
						<div className="mt-3 text-xs text-red-500">{modelsError}</div>
					) : (
						<>
							<div className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
								{selectedModel?.description || "Start a conversation to test this model."}
							</div>
							<div className="mt-3 flex flex-wrap gap-2 text-[11px]">
								<span className="rounded border px-2 py-1">
									Context: {selectedModel?.context_length ?? "-"} tokens
								</span>
								<span className="rounded border px-2 py-1">Input: {promptPrice}</span>
								<span className="rounded border px-2 py-1">Output: {completionPrice}</span>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
