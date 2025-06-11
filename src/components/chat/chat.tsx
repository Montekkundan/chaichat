"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import type { User } from "@clerk/nextjs/server";
import { useMutation, useQuery } from "convex/react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useChatHandlers } from "~/components/chat-input/use-chat-handlers";
import { Conversation } from "~/components/chat/conversation";
import { ChatInput } from "~/components/prompt-input";
import { toast } from "~/components/ui/toast";
import { db } from "~/db";
import { MESSAGE_MAX_LENGTH, MODEL_DEFAULT, SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { API_ROUTE_CHAT } from "~/lib/routes";
import { AnimatePresence, motion } from "motion/react"
import { cn } from "~/lib/utils";

function SearchParamsProvider({
    setInput,
  }: {
    setInput: (input: string) => void
  }) {
    const searchParams = useSearchParams()
  
    useEffect(() => {
      const prompt = searchParams.get("q")
      if (prompt) {
        setInput(prompt)
      }
    }, [searchParams, setInput])
  
    return null
  }

export default function Chat() {
    const { chatId } = useParams();
    const { user } = useUser();
    const [isSubmitting, setIsSubmitting] = useState(false)
    const searchParams = useSearchParams();

    const chatIdString = Array.isArray(chatId) ? chatId[0] : chatId;
    const chatIdConvex = chatIdString as Id<"chats">;
    // const currentChat = chatId ? getChatById(chatId) : null

    const [selectedModel, setSelectedModel] = useState(
        MODEL_DEFAULT
    )

    const [hydrated, setHydrated] = useState(false)
    const hasSentFirstMessageRef = useRef(false)

    const isAuthenticated = !!user?.id

    const convexMessages = useQuery(
        api.chat.getMessages,
        chatIdConvex ? { chatId: chatIdConvex } : "skip",
    );
    const addMessage = useMutation(api.chat.addMessage);


    const initialMessages = convexMessages?.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
    })) ?? []

    const {
        messages,
        input,
        handleSubmit,
        status,
        error,
        reload,
        stop,
        setMessages,
        setInput,
        append,
    } = useChat({
        api: API_ROUTE_CHAT,
        initialMessages,
        onFinish: async (message) => {
            // store the assistant message in the cache
        },
    })

    const pendingInput = searchParams.get("q");
    const hasAppendedPending = useRef(false);

    const { handleInputChange, handleModelChange, handleDelete, handleEdit } =
        useChatHandlers({
            messages,
            setMessages,
            setInput,
            setSelectedModel,
            selectedModel,
            chatId: chatIdConvex,
            //   updateChatModel,
            user: user as unknown as User,
        })

        const handleReload = async () => {
            // TODO await getOrCreateGuestUserId(user)
            const uid = user?.id
            if (!uid) {
              return
            }
        
            const options = {
              body: {
                chatId,
                userId: uid,
                model: selectedModel,
                isAuthenticated,
                systemPrompt: SYSTEM_PROMPT_DEFAULT,
              },
            }
        
            reload(options)
          }

    const handleSend = async (input: string) => {
        if (!input.trim() || !user?.id) return;
        await addMessage({
            chatId: chatIdConvex,
            userId: user.id,
            role: "user",
            content: input,
        });
        await append({ content: input, role: "user" });
        setInput("");
    };

    const handleAssistantMessage = async (assistantContent: string) => {
        const alreadyInConvex = convexMessages?.some(
            (m) => m.role === "assistant" && m.content === assistantContent,
        );
        if (!alreadyInConvex) {
            await addMessage({
                chatId: chatIdConvex,
                userId: "assistant",
                role: "assistant",
                content: assistantContent,
            });
            await db.messages.put({
                _id: crypto.randomUUID(),
                chatId: chatIdConvex,
                userId: "assistant",
                role: "assistant",
                content: assistantContent,
                createdAt: Date.now(),
            });
        }
    };

    // when chatId is null, set messages to an empty array
    useEffect(() => {
        if (chatId === null) {
            setMessages([])
        }
    }, [chatId, setMessages])

    useEffect(() => {
        setHydrated(true)
    }, [])

    // handle errors
    useEffect(() => {
        if (error) {
            let errorMsg = "Something went wrong."
            try {
                const parsed = JSON.parse(error.message)
                errorMsg = parsed.error || errorMsg
            } catch {
                errorMsg = error.message || errorMsg
            }
            toast({
                title: errorMsg,
                status: "error",
            })
        }
    }, [error])


    const submit = async () => {
        setIsSubmitting(true)

        // await getOrCreateGuestUserId(user)
        const uid = user?.id
        if (!uid) return

        const optimisticId = `optimistic-${Date.now().toString()}`
        // const optimisticAttachments =
        //   files.length > 0 ? createOptimisticAttachments(files) : []

        const optimisticMessage = {
            id: optimisticId,
            content: input,
            role: "user" as const,
            createdAt: new Date(),
            //   experimental_attachments:
            // 	optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
        }

        setMessages((prev) => [...prev, optimisticMessage])
        setInput("")

        // const submittedFiles = [...files]
        // setFiles([])

        // await checkLimitsAndNotify(uid)
        const allowed = true
        if (!allowed) {
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
            // cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
            setIsSubmitting(false)
            return
        }

        const currentChatId = chatIdConvex
        if (!currentChatId) {
            setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
            // cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
            setIsSubmitting(false)
            return
        }

        if (input.length > MESSAGE_MAX_LENGTH) {
            toast({
                title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
                status: "error",
            })
            setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
            // cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
            setIsSubmitting(false)
            return
        }

        // let attachments: Attachment[] | null = []
        // if (submittedFiles.length > 0) {
        //   attachments = await handleFileUploads(uid, currentChatId)
        //   if (attachments === null) {
        // 	setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        // 	cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
        // 	setIsSubmitting(false)
        // 	return
        //   }
        // }

        // const effectiveAgentId = searchAgentId || currentAgent?.id
        const options = {
            body: {
                chatId: currentChatId,
                userId: uid,
                model: selectedModel,
                isAuthenticated,
                systemPrompt: SYSTEM_PROMPT_DEFAULT,
                // ...(effectiveAgentId && { agentId: effectiveAgentId }),
            },
            //   experimental_attachments: attachments || undefined,
        }

        try {
            handleSubmit(undefined, options)
            setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
            //   cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
            //   cacheAndAddMessage(optimisticMessage)
            //   clearDraft()
            hasSentFirstMessageRef.current = true
        } catch {
            setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
            //   cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
            toast({ title: "Failed to send message", status: "error" })
        } finally {
            setIsSubmitting(false)
        }
    }

    useEffect(() => {
        if (convexMessages && messages.length === 0) {
            setMessages(
                convexMessages.map((m) => ({
                    id: m._id,
                    role: m.role,
                    content: m.content,
                })),
            );
        }
    }, [convexMessages, messages.length, setMessages]);

    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            pendingInput &&
            user &&
            !hasAppendedPending.current
        ) {
            const last = messages[messages.length - 1];
            if (!last || last.content !== pendingInput) {
                append({ content: pendingInput, role: "user" });
                setInput("");
                hasAppendedPending.current = true;
                // Remove the query param from the URL after appending
                const url = new URL(window.location.href);
                url.searchParams.delete("q");
                window.history.replaceState({}, "", url.pathname + url.search);
            }
        }
    }, [pendingInput, user, messages, append, setInput]);

    // Sync Convex messages to Dexie on fetch
    useEffect(() => {
        if (convexMessages && convexMessages.length > 0) {
            // Remove all Dexie messages for this chatId before putting new ones
            db.messages
                .where("chatId")
                .equals(chatIdConvex)
                .delete()
                .then(() => {
                    db.messages.bulkPut(convexMessages);
                });
            const userIds = Array.from(new Set(convexMessages.map((m) => m.userId)));
            Promise.all(
                userIds.map(async (id) => {
                    if (!id || id === "assistant") return;
                    const user = await db.users.get(id);
                    if (!user) {
                        try {
                            const res = await fetch(`/api/clerk-user/${id}`);
                            if (res.ok) {
                                const profile = await res.json();
                                await db.users.put(profile);
                            }
                        } catch { }
                    }
                }),
            );
        }
    }, [convexMessages, chatIdConvex]);

    // On load, try to load messages from Dexie for instant display
    useEffect(() => {
        let active = true;
        async function fetchLocalMessages() {
            if (chatIdConvex) {
                const localMessages = await db.messages
                    .where("chatId")
                    .equals(chatIdConvex)
                    .toArray();
                localMessages.sort((a, b) => {
                    const aTime =
                        a.createdAt ?? (a as { _creationTime?: number })._creationTime ?? 0;
                    const bTime =
                        b.createdAt ?? (b as { _creationTime?: number })._creationTime ?? 0;
                    return aTime - bTime;
                });
                if (active && localMessages.length > 0) {
                    setMessages(
                        localMessages.map((m) => ({
                            id: m._id,
                            role: m.role,
                            content: m.content,
                        })),
                    );
                }
            }
        }
        fetchLocalMessages();
        return () => {
            active = false;
        };
    }, [chatIdConvex, setMessages]);

    // Always use Convex as source of truth after initial load
    useEffect(() => {
        type ConvexMsg = {
            _id: string;
            role: string;
            content: string;
            _creationTime?: number;
        };
        function isConvexMsg(m: unknown): m is ConvexMsg {
            return (
                typeof m === "object" &&
                m !== null &&
                "_id" in m &&
                "role" in m &&
                "content" in m
            );
        }
        if (convexMessages) {
            const unique = new Map();
            const mapped: ConvexMsg[] = convexMessages
                .filter(isConvexMsg)
                .map((m) => ({
                    _id: m._id,
                    role: m.role,
                    content: m.content,
                    _creationTime: (m as { _creationTime?: number })._creationTime,
                }));
            const sorted = mapped.sort((a, b) => {
                if (a._creationTime && b._creationTime) {
                    return a._creationTime - b._creationTime;
                }
                return 0;
            });
            for (const m of sorted) {
                unique.set(m._id, { id: m._id, role: m.role, content: m.content });
            }
            setMessages(Array.from(unique.values()));
        }
    }, [convexMessages, setMessages]);

    const mappedMessages = messages.map((m, idx) => ({
        id: m.id ?? String(idx),
        role: m.role as "user" | "assistant",
        content: m.content,
    }));

    return (
        <div
            className={cn(
                "@container/main relative flex h-full flex-col items-center justify-end md:justify-center"
            )}
        >

            <Suspense>
                <SearchParamsProvider setInput={setInput} />
            </Suspense>

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
                    // <Conversation messages={mappedMessages} />
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
                    // onSuggestion={handleSuggestion}
                    onValueChange={handleInputChange}
                    onSend={submit}
                    isSubmitting={isSubmitting}
                    // files={files}
                    // onFileUpload={handleFileUpload}
                    // onFileRemove={handleFileRemove}
                    // hasSuggestions={
                    // 	preferences.promptSuggestions && !chatId && messages.length === 0
                    // }
                    onSelectModel={handleModelChange}
                    selectedModel={selectedModel}
                    isUserAuthenticated={isAuthenticated}
                    stop={stop}
                    status={status}
                // onSearchToggle={handleSearchToggle}
                />
            </motion.div>
        </div>
    );
}
