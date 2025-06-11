"use client";
import { useCallback, useState } from "react";
import { CookiePreferencesModal } from "~/components/modals/cookie-preferences-modal";
import { Button } from "~/components/ui/button";
import {
	PromptInput,
	PromptInputAction,
	PromptInputActions,
	PromptInputTextarea,
} from "~/components/ui/prompt-input";
import { getModelInfo } from "~/lib/models";
import { ArrowUp, Stop, Warning } from "@phosphor-icons/react"
import { ModelSelector } from "./chat-input/model-selector";

type ChatInputProps = {
	value: string
	onValueChange: (value: string) => void
	onSend: () => void
	isSubmitting?: boolean
	hasMessages?: boolean
	// files: File[]
	// onFileUpload: (files: File[]) => void
	// onFileRemove: (file: File) => void
	// onSuggestion: (suggestion: string) => void
	// hasSuggestions?: boolean
	onSelectModel: (model: string) => void
	selectedModel: string
	isUserAuthenticated: boolean
	stop: () => void
	status?: "submitted" | "streaming" | "ready" | "error"
	// onSearchToggle?: (enabled: boolean, agentId: string | null) => void
	position?: "centered" | "bottom"
}

export function ChatInput({
	value,
	onValueChange,
	onSend,
	isSubmitting,
	// files,
	// onFileUpload,
	// onFileRemove,
	// onSuggestion,
	// hasSuggestions,
	onSelectModel,
	selectedModel,
	isUserAuthenticated,
	stop,
	status,
	// onSearchToggle,
	position = "centered",
}: ChatInputProps) {
	const selectModelConfig = getModelInfo(selectedModel)
	const hasToolSupport = Boolean(selectModelConfig?.tools)
	const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text)

	// Handle search toggle
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	//   const handleSearchToggle = useCallback(
	//     (enabled: boolean) => {
	//       toggleSearch(enabled)
	//       const agentId = enabled ? "search" : null
	//       onSearchToggle?.(enabled, agentId)
	//     },
	//     [toggleSearch, onSearchToggle]
	//   )

	//   const handleSend = useCallback(() => {
	//     if (isSubmitting) {
	//       return
	//     }

	//     if (status === "streaming") {
	//       stop()
	//       return
	//     }

	//     onSend()
	//   }, [isSubmitting, onSend, status, stop])

	const handleSend = useCallback(() => {
		if (isSubmitting) {
			return
		}

		if (status === "streaming") {
			stop()
			return
		}

		onSend()
	}, [isSubmitting, onSend, status, stop])

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// First process agent command related key handling
			//   agentCommand.handleKeyDown(e)

			if (isSubmitting) {
				e.preventDefault()
				return
			}

			if (e.key === "Enter" && status === "streaming") {
				e.preventDefault()
				return
			}

			//   if (e.key === "Enter" && !e.shiftKey && !agentCommand.showAgentCommand) {
			//     if (isOnlyWhitespace(value)) {
			//       return
			//     }

			//     e.preventDefault()
			//     onSend()
			//   }
		},
		[isSubmitting, onSend, status, value]
	)

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const handlePaste = useCallback(
		async (e: ClipboardEvent) => {
			const items = e.clipboardData?.items
			if (!items) return

			const hasImageContent = Array.from(items).some((item) =>
				item.type.startsWith("image/")
			)

			if (!isUserAuthenticated && hasImageContent) {
				e.preventDefault()
				return
			}

			if (isUserAuthenticated && hasImageContent) {
				const imageFiles: File[] = []

				for (const item of Array.from(items)) {
					if (item.type.startsWith("image/")) {
						const file = item.getAsFile()
						if (file) {
							const newFile = new File(
								[file],
								`pasted-image-${Date.now()}.${file.type.split("/")[1]}`,
								{ type: file.type }
							)
							imageFiles.push(newFile)
						}
					}
				}

				// if (imageFiles.length > 0) {
				//   onFileUpload(imageFiles)
				// }
			}
			// Text pasting will work by default for everyone
		},
		[isUserAuthenticated]
	)


	const [showCookieModal, setShowCookieModal] = useState(false);
	const mainContent = (
		<div className="w-full max-w-3xl">
			<PromptInput
				className="bg-popover relative z-10 p-0 pt-1 shadow-xs backdrop-blur-xl"
				maxHeight={200}
				value={value}
			//   onValueChange={agentCommand.handleValueChange}
			>
				{/* {agentCommand.showAgentCommand && (
            <div className="absolute bottom-full left-0 w-full">
              <AgentCommand
                isOpen={agentCommand.showAgentCommand}
                searchTerm={agentCommand.agentSearchTerm}
                onSelect={agentCommand.handleAgentSelect}
                onClose={agentCommand.closeAgentCommand}
                activeIndex={agentCommand.activeAgentIndex}
                onActiveIndexChange={agentCommand.setActiveAgentIndex}
                curatedAgents={curatedAgents || []}
                userAgents={userAgents || []}
              />
            </div>
          )} */}
				{/* <SelectedAgent
            selectedAgent={agentCommand.selectedAgent}
            removeSelectedAgent={agentCommand.removeSelectedAgent}
          /> */}
				{/* <FileList files={files} onFileRemove={onFileRemove} /> */}
				<PromptInputTextarea
					placeholder="Ask ChaiChat"
					onKeyDown={handleKeyDown}
					onChange={e => onValueChange(e.target.value)}
					className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
				// ref={agentCommand.textareaRef}
				/>
				<PromptInputActions className="mt-5 w-full justify-between px-3 pb-3">
					<div className="flex gap-2">
						{/* <ButtonFileUpload
                onFileUpload={onFileUpload}
                isUserAuthenticated={isUserAuthenticated}
                model={selectedModel}
              /> */}
						<ModelSelector
							selectedModelId={selectedModel}
							setSelectedModelId={onSelectModel}
							isUserAuthenticated={isUserAuthenticated}
							className="rounded-full"
						/>
						{/* <ButtonSearch
                isSelected={isSearchEnabled}
                onToggle={handleSearchToggle}
                isAuthenticated={isUserAuthenticated}
              /> */}
						{/* {currentAgent && !hasToolSupport && (
                <div className="flex items-center gap-1">
                  <Warning className="size-4" />
                  <p className="line-clamp-2 text-xs">
                    {selectedModel} does not support tools. Agents may not work
                    as expected.
                  </p>
                </div>
              )} */}
					</div>
					<PromptInputAction
						tooltip={status === "streaming" ? "Stop" : "Send"}
					>
						<Button
							size="sm"
							className="size-9 rounded-full transition-all duration-300 ease-out"
							disabled={!value || isSubmitting || isOnlyWhitespace(value)}
							type="button"
							onClick={handleSend}
							aria-label={status === "streaming" ? "Stop" : "Send message"}
						>
							{status === "streaming" ? (
								<Stop className="size-4" />
							) : (
								<ArrowUp className="size-4" />
							)}
						</Button>
					</PromptInputAction>
				</PromptInputActions>
			</PromptInput>
			{position === "bottom" && (
				<>
					<div className="h-3" />
					<div className="select-none pb-1 text-center text-muted-foreground text-xs">
						ChaiChat can make mistakes. Check important info.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							onClick={() => setShowCookieModal(true)}
						>
							See Cookie Preferences.
						</button>
					</div>
					<CookiePreferencesModal
						open={showCookieModal}
						onOpenChange={setShowCookieModal}
					/>
				</>
			)}
		</div>
	);

	if (position === "bottom") {
		return (
			<div className="fixed inset-x-0 bottom-0 z-20 flex w-full justify-center p-4">
				{mainContent}
			</div>
		);
	}
	return mainContent;
}
