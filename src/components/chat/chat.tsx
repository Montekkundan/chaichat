"use client";

import { useUser } from "@clerk/nextjs";
import type { User } from "@clerk/nextjs/server";
import { Settings2, SunMoon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useChatHandlers } from "~/components/chat-input/use-chat-handlers";
import { Conversation } from "~/components/chat/conversation";
import { ChatInput } from "~/components/chat-input/chat-input";
import { useMessages } from "~/lib/providers/messages-provider";
import { cn } from "~/lib/utils";
import { useSidebar } from "../ui/sidebar";
import { useQuota } from "~/lib/providers/quota-provider";
import type { UploadedFile } from "~/components/chat-input/file-items";

type ChatProps = { initialName?: string };

export default function Chat({ initialName }: ChatProps = {}) {
	const { chatId } = useParams();
	const { user } = useUser();
	const router = useRouter();
	const [isCreatingChat, setIsCreatingChat] = useState(false);
	const [hasNavigated, setHasNavigated] = useState(false);
	const [attachments, setAttachments] = useState<UploadedFile[]>([]);

	const {
		messages,
		input,
		setInput,
		status,
		isSubmitting,
		selectedModel,
		setSelectedModel,
		sendMessage,
		createNewChat,
		changeModel,
		regenerateMessage,
		stop,
		quotaExceeded,
		rateLimited,
	} = useMessages();

	const chatIdString = Array.isArray(chatId) ? chatId[0] : chatId;

	useEffect(() => {
		if (chatIdString && !hasNavigated) {
			setHasNavigated(true);
		}
	}, [chatIdString, hasNavigated]);

	// Determine if we should show onboarding (home page with no messages)
	const showOnboarding = !chatIdString && messages.length === 0;

	// // Determine if we should animate the input position
	// const shouldAnimateInput = hasNavigated || messages.length > 0;

	const { handleInputChange, handleModelChange, handleDelete, handleEdit } =
		useChatHandlers({
			messages,
			setMessages: () => {}, // Not needed with provider
			setInput,
			setSelectedModel: changeModel,
			selectedModel,
			chatId: chatIdString || null,
			user: user as unknown as User | null,
		});

	const handleReload = async () => {
		// TODO: implement reload in provider if needed
	};

	const handleFileUpload = (files: UploadedFile[]) => {
		setAttachments((prev) => [...prev, ...files]);
	};

	const handleFileRemove = (file: UploadedFile) => {
		setAttachments((prev) => prev.filter((f) => f !== file));
	};

	const handleSend = async (attachmentFiles: UploadedFile[] = []) => {
		if (!input.trim() && attachmentFiles.length === 0) return;

		// Capture current data before we clear UI (optimistic)
		const messageToSend = input;
		const attToSend = attachmentFiles;

		// Optimistically clear UI for snappy feel
		setInput("");
		setAttachments([]);

		// If no chatId, create a new chat first (async)
		if (!chatIdString) {
			setIsCreatingChat(true);
			try {
				const newChatId = await createNewChat(messageToSend, selectedModel);
				// Navigate to the new chat; provider will send message automatically from query param
				router.push(`/chat/${newChatId}?q=${encodeURIComponent(messageToSend)}`);
			} catch (error) {
				console.error("Failed to create chat:", error);
				// Revert UI on error
				setInput(messageToSend);
				setAttachments(attToSend);
			} finally {
				setIsCreatingChat(false);
			}
			return;
		}

		// Send message in existing chat (async, but UI already cleared)
		try {
			sendMessage(messageToSend, attToSend);
		} catch (err) {
			console.error("Send message failed:", err);
			// On failure restore content so user can retry
			setInput(messageToSend);
			setAttachments(attToSend);
		}
	};

	const isLoading = isSubmitting || isCreatingChat || status === "streaming";

	const { resolvedTheme, setTheme } = useTheme();

	const { state } = useSidebar();
	const collapsed = state === "collapsed";

	return (
		<>
			<div className="pointer-events-none absolute bottom-0 z-10 w-full px-2">
				<div className="relative mx-auto flex w-full max-w-3xl flex-col text-center">
					{/* Anonymous quota banner */}
					{!user?.id && (
						<AnonQuotaBanner />
					)}
					<div className="pointer-events-none">
						<div className="pointer-events-auto">
							<div className="rounded-t-3xl p-2 pb-0 backdrop-blur-lg ">
								<ChatInput
									value={input}
									onValueChange={handleInputChange}
									onSend={handleSend}
									isSubmitting={isLoading}
									disabled={quotaExceeded || rateLimited}
									onSelectModel={handleModelChange}
									selectedModel={selectedModel}
									isUserAuthenticated={!!user?.id}
									stop={stop}
									status={status}
									files={attachments}
									onFileUpload={handleFileUpload}
									onFileRemove={handleFileRemove}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div
				className="absolute inset-0 overflow-y-scroll sm:pt-3.5"
				style={{ paddingBottom: "144px", scrollbarGutter: "stable both-edges" }}
			>
				<div
					className="fixed top-0 right-0 z-20 h-16 w-28 max-sm:hidden"
					style={{ clipPath: "inset(0px 12px 0px 0px)" }}
				>
					<div
						className={`group -mb-8 pointer-events-none absolute top-3.5 z-10 h-32 w-full origin-top transition-all ease-snappy${
							collapsed ? " -translate-y-3.5 scale-y-0" : ""
						}`}
						style={{
							boxShadow: "10px -10px 8px 2px var(--gradient-noise-top)",
						}}
					>
						<svg
							className="-right-8 absolute h-9 origin-top-left skew-x-[30deg] overflow-visible"
							viewBox="0 0 128 32"
							aria-hidden="true"
							role="presentation"
						>
							<line
								stroke="var(--gradient-noise-top)"
								strokeWidth="2px"
								shapeRendering="optimizeQuality"
								vectorEffect="non-scaling-stroke"
								strokeLinecap="round"
								strokeMiterlimit="10"
								x1="1"
								y1="0"
								x2="128"
								y2="0"
							/>
							<path
								stroke="var(--chat-border)"
								className="translate-y-[0.5px]"
								fill="var(--gradient-noise-top)"
								shapeRendering="optimizeQuality"
								strokeWidth="1px"
								strokeLinecap="round"
								strokeMiterlimit="10"
								vectorEffect="non-scaling-stroke"
								d="M0,0c5.9,0,10.7,4.8,10.7,10.7v10.7c0,5.9,4.8,10.7,10.7,10.7H128V0"
							/>
						</svg>
					</div>
				</div>
				<div className="fixed top-2 right-2 z-20 max-sm:hidden">
					<div className="flex flex-row items-center gap-0.5 rounded-md rounded-bl-xl bg-gradient-noise-top p-1 text-muted-foreground transition-all">
						<Link
							aria-label="Go to settings"
							href="/settings/customization"
							className="inline-flex size-8 items-center justify-center rounded-md rounded-bl-xl hover:bg-muted/40 hover:text-foreground"
							data-discover="true"
						>
							<Settings2 className="size-4" />
						</Link>
						<button
							type="button"
							aria-label="Toggle theme"
							className="group relative inline-flex size-8 items-center justify-center rounded-md hover:bg-muted/40 hover:text-foreground"
							onClick={() =>
								setTheme(resolvedTheme === "dark" ? "light" : "dark")
							}
						>
							<SunMoon className="absolute size-4" />
							<span className="sr-only">Toggle theme</span>
						</button>
					</div>
				</div>
				<div className="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pt-safe-offset-10 pb-10">
					{showOnboarding ? (
						<div className="flex h-[calc(100vh-20rem)] items-start justify-center">
							<div className="fade-in-50 zoom-in-95 w-full animate-in space-y-6 px-2 pt-[calc(max(15vh,2.5rem))] duration-300 sm:px-8">
								<h2 className="font-semibold text-3xl">
									How can I help you {user?.firstName ?? initialName ?? ""}?
								</h2>
							</div>
						</div>
					) : (
						<Conversation
							messages={messages}
							status={status}
							onDelete={handleDelete}
							onEdit={handleEdit}
							onReload={handleReload}
							onRegenerate={regenerateMessage}
						/>
					)}
				</div>
			</div>
		</>
	);
}

// Banner shown to anonymous visitors indicating remaining credits
function AnonQuotaBanner() {
	const quota = useQuota();
	if (quota.plan !== "anonymous") return null;
	const remaining = quota.stdCredits ?? 0;
	return (
		<div className="pointer-events-auto mb-2 rounded-md bg-muted/50 py-1 px-4 text-sm text-muted-foreground backdrop-blur-lg">
			{remaining} free messages left. <Link href="/sign-in" className="underline">Sign in</Link> for more.
		</div>
	);
}
