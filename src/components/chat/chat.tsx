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
import { ChatInput } from "~/components/prompt-input";
import { useMessages } from "~/lib/providers/messages-provider";
import { cn } from "~/lib/utils";
import { useSidebar } from "../ui/sidebar";

export default function Chat() {
    const { chatId } = useParams();
    const { user } = useUser();
    const router = useRouter();
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [hasNavigated, setHasNavigated] = useState(false);

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
    } = useMessages();

    const chatIdString = Array.isArray(chatId) ? chatId[0] : chatId;

    // Track navigation for animation purposes
    useEffect(() => {
        if (chatIdString && !hasNavigated) {
            setHasNavigated(true);
        }
    }, [chatIdString, hasNavigated]);

    // Determine if we should show onboarding (home page with no messages)
    const showOnboarding = !chatIdString && messages.length === 0;

    // Determine if we should animate the input position
    const shouldAnimateInput = hasNavigated || messages.length > 0;

    const { handleInputChange, handleModelChange, handleDelete, handleEdit } =
        useChatHandlers({
            messages,
            setMessages: () => { }, // Not needed with provider
            setInput,
            setSelectedModel: changeModel,
            selectedModel,
            chatId: chatIdString || null,
            user: user as unknown as User | null,
        });

    const handleReload = async () => {
        // TODO: implement reload in provider if needed
    };

    const handleSend = async () => {
        if (!input.trim() || !user?.id) return;

        // If no chatId, create a new chat first
        if (!chatIdString) {
            setIsCreatingChat(true);
            try {
                const newChatId = await createNewChat(input, selectedModel);
                // Navigate to the new chat and the message will be sent automatically
                router.push(`/chat/${newChatId}?q=${encodeURIComponent(input)}`);
            } catch (error) {
                console.error("Failed to create chat:", error);
            } finally {
                setIsCreatingChat(false);
            }
            return;
        }

        // Send message in existing chat
        await sendMessage(input);
    };

    const isLoading = isSubmitting || isCreatingChat || status === "streaming";

    const { resolvedTheme, setTheme } = useTheme();

    const { state } = useSidebar();
    const collapsed = state === "collapsed";

    return (
        <>
            <div className="pointer-events-none absolute bottom-0 z-10 w-full px-2">
                <div className="relative mx-auto flex w-full max-w-3xl flex-col text-center">
                    <div className="pointer-events-none">
                        <div className="pointer-events-auto">
                            <div className="rounded-t-3xl p-2 pb-0 backdrop-blur-lg ">
                                <ChatInput
                                    value={input}
                                    onValueChange={handleInputChange}
                                    onSend={handleSend}
                                    isSubmitting={isLoading}
                                    onSelectModel={handleModelChange}
                                    selectedModel={selectedModel}
                                    isUserAuthenticated={!!user?.id}
                                    stop={stop}
                                    status={status}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="absolute inset-0 overflow-y-scroll sm:pt-3.5" style={{ paddingBottom: '144px', scrollbarGutter: 'stable both-edges' }}>
                <div
                    className="fixed right-0 top-0 z-20 h-16 w-28 max-sm:hidden"
                    style={{ clipPath: "inset(0px 12px 0px 0px)" }}
                >
                    <div
                        className={`group pointer-events-none absolute top-3.5 z-10 -mb-8 h-32 w-full origin-top transition-all ease-snappy${collapsed ? " -translate-y-3.5 scale-y-0" : ""
                            }`}
                        style={{ boxShadow: "10px -10px 8px 2px var(--gradient-noise-top)" }}
                    >
                        <svg
                            className="absolute -right-8 h-9 origin-top-left skew-x-[30deg] overflow-visible"
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
                <div className="fixed right-2 top-2 z-20 max-sm:hidden">
                    <div className="flex flex-row items-center bg-gradient-noise-top text-muted-foreground gap-0.5 rounded-md p-1 transition-all rounded-bl-xl">
                        <Link
                            aria-label="Go to settings"
                            href="/settings/customization"
                            className="size-8 inline-flex items-center justify-center rounded-md hover:bg-muted/40 hover:text-foreground rounded-bl-xl"
                            data-discover="true"
                        >
                            <Settings2 className="size-4" />
                        </Link>
                        <button
                            type="button"
                            aria-label="Toggle theme"
                            className="group relative size-8 inline-flex items-center justify-center rounded-md hover:bg-muted/40 hover:text-foreground"
                            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                        >
                            <SunMoon className="absolute size-4" />
                            <span className="sr-only">Toggle theme</span>
                        </button>
                    </div>
                </div>
                <div className="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pb-10 pt-safe-offset-10">
                    {showOnboarding ? (
                        <div className="flex h-[calc(100vh-20rem)] items-start justify-center">
                            <div className="w-full space-y-6 px-2 pt-[calc(max(15vh,2.5rem))] duration-300 animate-in fade-in-50 zoom-in-95 sm:px-8">
                                <h2 className="text-3xl font-semibold">
                                    How can I help you {user?.firstName}?
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
        // 	className={cn(
        // 		"@container/main relative flex h-full flex-col",
        // 		showOnboarding ? "items-center justify-center" : "",
        // 	)}
        // >
        // 	{showOnboarding ? (
        // 		<div className="flex w-full flex-1 flex-col items-center justify-center">
        // 			<AnimatePresence initial={false} mode="popLayout">
        // 				<motion.div
        // 					key="onboarding"
        // 					className="mx-auto mb-8 max-w-[50rem]"
        // 					initial={{ opacity: 0, y: 20 }}
        // 					animate={{ opacity: 1, y: 0 }}
        // 					exit={{ opacity: 0, y: -20 }}
        // 					transition={{ duration: 0.3, ease: "easeOut" }}
        // 				>
        // 					<h1 className="mb-6 font-medium text-3xl tracking-tight">
        // 						What&apos;s on your mind?
        // 					</h1>
        // 				</motion.div>
        // 			</AnimatePresence>

        // 			<motion.div
        // 				className="mx-auto w-full max-w-3xl"
        // 				layout="position"
        // 				layoutId="chat-input-container"
        // 				transition={{
        // 					layout: {
        // 						duration: shouldAnimateInput ? 0.4 : 0,
        // 						ease: "easeInOut",
        // 					},
        // 				}}
        // 			>
        // 				<ChatInput
        // 					value={input}
        // 					onValueChange={handleInputChange}
        // 					onSend={handleSend}
        // 					isSubmitting={isLoading}
        // 					onSelectModel={handleModelChange}
        // 					selectedModel={selectedModel}
        // 					isUserAuthenticated={!!user?.id}
        // 					stop={stop}
        // 					status={status}
        // 				/>
        // 			</motion.div>
        // 		</div>
        // 	) : (
        // 		<>
        // 			<AnimatePresence initial={false} mode="popLayout">
        // 				<motion.div
        // 					key="conversation"
        // 					initial={{ opacity: 0 }}
        // 					animate={{ opacity: 1 }}
        // 					transition={{ duration: 0.3 }}
        // 					className="w-full flex-1 overflow-auto"
        // 				>
        // 					<Conversation
        // 						messages={messages}
        // 						status={status}
        // 						onDelete={handleDelete}
        // 						onEdit={handleEdit}
        // 						onReload={handleReload}
        // 						onRegenerate={regenerateMessage}
        // 					/>
        // 				</motion.div>
        // 			</AnimatePresence>

        // 			<motion.div
        // 				className="relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl"
        // 				layout="position"
        // 				layoutId="chat-input-container"
        // 				transition={{
        // 					layout: {
        // 						duration: shouldAnimateInput ? 0.4 : 0,
        // 						ease: "easeInOut",
        // 					},
        // 				}}
        // 			>
        // 				<ChatInput
        // 					value={input}
        // 					onValueChange={handleInputChange}
        // 					onSend={handleSend}
        // 					isSubmitting={isLoading}
        // 					onSelectModel={handleModelChange}
        // 					selectedModel={selectedModel}
        // 					isUserAuthenticated={!!user?.id}
        // 					stop={stop}
        // 					status={status}
        // 				/>
        // 			</motion.div>
        // 		</>
        // 	)}
        // </div>
    );
}
