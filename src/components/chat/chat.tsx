"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Conversation } from "~/components/chat/conversation";
import { ChatInput } from "~/components/prompt-input";
import { cn } from "~/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useMessages } from "~/lib/providers/messages-provider";
import { useChatHandlers } from "~/components/chat-input/use-chat-handlers";
import { useUser } from "@clerk/nextjs";
import type { User } from "@clerk/nextjs/server";

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

    const handleSend = async () => {
        if (!input.trim() || !user?.id) return;

        // If no chatId, create a new chat first
        if (!chatIdString) {
            setIsCreatingChat(true);
            try {
                const newChatId = await createNewChat(input, selectedModel);
                // Navigate to the new chat and the message will be sent automatically
                const url = new URL(`${window.location.origin}/chat/${newChatId}`);
                url.searchParams.set('q', input);
                router.push(url.pathname + url.search);
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

    return (
        <div
            className={cn(
                "@container/main relative flex h-full flex-col",
                showOnboarding ? "items-center justify-center" : ""
            )}
        >
            {showOnboarding ? (
                <div className="flex flex-col items-center justify-center flex-1 w-full">
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.div
                            key="onboarding"
                            className="mx-auto max-w-[50rem] mb-8"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            <h1 className="mb-6 text-3xl font-medium tracking-tight">
                                What&apos;s on your mind?
                            </h1>
                        </motion.div>
                    </AnimatePresence>
                    
                    <motion.div
                        className="w-full max-w-3xl mx-auto"
                        layout="position"
                        layoutId="chat-input-container"
                        transition={{
                            layout: {
                                duration: shouldAnimateInput ? 0.4 : 0,
                                ease: "easeInOut"
                            },
                        }}
                    >
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
                    </motion.div>
                </div>
            ) : (
                <>
                    <AnimatePresence initial={false} mode="popLayout">
                        <motion.div
                            key="conversation"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="flex-1 w-full overflow-auto"
                        >
                            <Conversation
                                messages={messages}
                                status={status}
                                onDelete={handleDelete}
                                onEdit={handleEdit}
                                onReload={handleReload}
                                onRegenerate={regenerateMessage}
                            />
                        </motion.div>
                    </AnimatePresence>
                    
                    <motion.div
                        className="relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl"
                        layout="position"
                        layoutId="chat-input-container"
                        transition={{
                            layout: {
                                duration: shouldAnimateInput ? 0.4 : 0,
                                ease: "easeInOut"
                            },
                        }}
                    >
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
                    </motion.div>
                </>
            )}
        </div>
    );
}
