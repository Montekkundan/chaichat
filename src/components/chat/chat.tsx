"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
        stop,
    } = useMessages();

    const chatIdString = Array.isArray(chatId) ? chatId[0] : chatId;

    const { handleInputChange, handleModelChange, handleDelete, handleEdit } =
        useChatHandlers({
            messages,
            setMessages: () => {}, // Not needed with provider
            setInput,
            setSelectedModel,
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
                "@container/main relative flex h-full flex-col items-center justify-end md:justify-center"
            )}
        >
            <AnimatePresence initial={false} mode="popLayout">
                {!chatId && messages.length === 0 ? (
                    <motion.div
                        key="onboarding"
                        className="absolute bottom-[60%] mx-auto max-w-[50rem] md:relative md:bottom-auto"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        layout="position"
                        layoutId="onboarding"
                        transition={{
                            layout: {
                                duration: 0,
                            },
                        }}
                    >
                        <h1 className="mb-6 text-3xl font-medium tracking-tight">
                            What&apos;s on your mind?
                        </h1>
                    </motion.div>
                ) : (
                    <Conversation
                        key="conversation"
                        messages={messages}
                        status={status}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onReload={handleReload}
                    />
                )}
            </AnimatePresence>
            <motion.div
                className={cn(
                    "relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl"
                )}
                layout="position"
                layoutId="chat-input-container"
                transition={{
                    layout: {
                        duration: messages.length === 1 ? 0.3 : 0,
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
    );
}
