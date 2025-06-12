"use client";

import { useChat, type Message as MessageAISDK } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { toast } from "~/components/ui/toast";
import { API_ROUTE_CHAT } from "~/lib/routes";
import { SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { useCache } from "./cache-provider";
import type { Id } from "@/convex/_generated/dataModel";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";

interface MessagesContextType {
  messages: MessageAISDK[];
  input: string;
  setInput: (input: string) => void;
  status: "streaming" | "ready" | "submitted" | "error";
  error: Error | undefined;
  isSubmitting: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  sendMessage: (message: string) => Promise<void>;
  createNewChat: (initialMessage: string, model: string) => Promise<string>;
  changeModel: (model: string) => Promise<void>;
  regenerateMessage: (messageIndex: number, newModel?: string) => Promise<void>;
  stop: () => void;
  reload: () => void;
}

const MessagesContext = createContext<MessagesContextType | null>(null);

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context)
    throw new Error("useMessages must be used within MessagesProvider");
  return context;
}

interface MessagesProviderProps {
  children: React.ReactNode;
  chatId?: string;
  initialModel?: string;
}

export function MessagesProvider({ 
  children, 
  chatId,
  initialModel = "gpt-4o" 
}: MessagesProviderProps) {
  const { user } = useUser();
  const cache = useCache();
  const convex = useConvex();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [cachedMessages, setCachedMessages] = useState<MessageAISDK[]>([]);
  
  // Track regeneration context - use useRef to persist across re-renders
  const regenerationContext = useRef<{
    parentMessageId: string;
    version: number;
  } | null>(null);

  // Load messages from cache when chatId changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!chatId) {
        setCachedMessages([]);
        return;
      }

      try {
        const messages = await cache.getMessages(chatId);
        const aiSdkMessages = messages.map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
          model: m.model,
          convexId: m._id,
        })) as MessageAISDK[];
        
        setCachedMessages(aiSdkMessages);
      } catch (error) {
        console.error("Failed to load messages from cache:", error);
      }
    };

    loadMessages();
  }, [chatId, cache]);

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
    initialMessages: [],
    onFinish: async (message) => {
      if (!chatId || !user?.id) return;

      if (message.role === "assistant") {
        try {
          if (regenerationContext.current) {
            // For regenerated messages, mark original as version 1 and save new version
            await cache.markAsOriginalVersion(regenerationContext.current.parentMessageId);

            const convexMessageId = await cache.addMessage({
              chatId,
              userId: user.id,
              role: "assistant",
              content: message.content,
              model: selectedModel,
              parentMessageId: regenerationContext.current.parentMessageId,
              version: regenerationContext.current.version,
              createdAt: Date.now(),
            });

            setMessages(currentMessages => 
              currentMessages.map(msg => 
                msg.id === message.id 
                  ? { ...msg, convexId: convexMessageId }
                  : msg
              )
            );

            regenerationContext.current = null;
          } else {
            // For regular messages (not regenerated)
            const convexMessageId = await cache.addMessage({
              chatId,
              userId: user.id,
              role: "assistant",
              content: message.content,
              model: selectedModel,
              createdAt: Date.now(),
            });

            setMessages(currentMessages => 
              currentMessages.map(msg => 
                msg.id === message.id 
                  ? { ...msg, convexId: convexMessageId }
                  : msg
              )
            );
          }
        } catch (error) {
          console.error("Failed to save assistant message:", error);
          regenerationContext.current = null;
        }
      }
    },
    onError: (error) => {
      console.error("AI Chat error:", error);
      toast({
        title: "Failed to get AI response",
        status: "error",
      });
    }
  });

  useEffect(() => {
    if (cachedMessages.length > 0 && status === "ready") {
      setMessages(cachedMessages);
    }
  }, [cachedMessages, setMessages, status]);

  useEffect(() => {
    if (chatId === null) {
      setMessages([]);
      setCachedMessages([]);
    }
    hasAppendedPending.current = false;
  }, [chatId, setMessages]);

  // Register callback for force reloading messages when versions change
  useEffect(() => {
    const handleMessagesChanged = async (changedChatId: string) => {
      if (changedChatId === chatId) {
        // Force reload from Convex and update cache
        try {
          // Query Convex directly for fresh data
          const convexMessages = await convex.query(api.chat.getMessages, { 
            chatId: changedChatId as Id<"chats">
          });
          
          // Convert to AI SDK format
          const aiSdkMessages = convexMessages.map((m) => ({
            id: m._id,
            role: m.role,
            content: m.content,
            model: m.model,
            convexId: m._id,
          })) as MessageAISDK[];
          
          setCachedMessages(aiSdkMessages);
          setMessages(aiSdkMessages);
        } catch (error) {
          console.error("Failed to reload messages from Convex:", error);
        }
      }
    };

    cache.setOnMessagesChanged(handleMessagesChanged);
  }, [chatId, cache, convex, setMessages]);

  const createNewChat = async (initialMessage: string, model: string): Promise<string> => {
    if (!user?.id) throw new Error("User not authenticated");
    
    const chatName = initialMessage.slice(0, 50);
    const newChatId = await cache.createChat(chatName, model);
    
    return newChatId;
  };

  const changeModel = useCallback(async (model: string): Promise<void> => {
    setSelectedModel(model);
    
    // Update the chat's current model if we have a chatId
    if (chatId) {
      await cache.updateChatModel(chatId, model);
    }
  }, [chatId, cache]);

  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || !user?.id || !chatId) return;
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const submitOptions = {
        body: {
          chatId: chatId as Id<"chats">,
          userId: user.id,
          model: selectedModel,
          isAuthenticated: true,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
        },
      };

      await cache.addMessage({
        chatId,
        userId: user.id,
        role: "user",
        content: messageContent,
        model: selectedModel,
        createdAt: Date.now(),
      });

      await append(
        {
          role: "user",
          content: messageContent,
        },
        submitOptions
      );
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send message",
        status: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, chatId, selectedModel, append, isSubmitting, cache]);

  const hasAppendedPending = useRef(false);
  const hasSentPending = useRef(false);
  const [pendingInputToSend, setPendingInputToSend] = useState<string | null>(null);
  
  useEffect(() => {
    if (typeof window !== "undefined" && !hasAppendedPending.current) {
      const url = new URL(window.location.href);
      const pendingInput = url.searchParams.get("q");
      
      if (pendingInput) {
        setPendingInputToSend(pendingInput);
        hasAppendedPending.current = true;
        
        url.searchParams.delete("q");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, []);
  
  useEffect(() => {
    if (pendingInputToSend && chatId && user?.id && status === "ready" && messages.length === 0 && !hasSentPending.current) {
      hasSentPending.current = true;
      
      setTimeout(() => {
        sendMessage(pendingInputToSend);
        setPendingInputToSend(null);
      }, 300);
    }
  }, [pendingInputToSend, chatId, user?.id, status, messages.length, sendMessage]);

  useEffect(() => {
    hasSentPending.current = false;
  }, []);

  const regenerateMessage = useCallback(async (messageIndex: number, newModel?: string) => {
    if (!user?.id || !chatId || messageIndex < 0) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const assistantMessage = messages[messageIndex];
      
      if (!assistantMessage || assistantMessage.role !== "assistant") {
        console.error("Could not find assistant message to regenerate");
        return;
      }

      const convexId = (assistantMessage as MessageAISDK & { convexId?: string }).convexId;
      
      const actualConvexId = convexId || assistantMessage.id;
      
      if (!actualConvexId) {
        console.error("No ID found for message - cannot regenerate");
        return;
      }

      const userMessage = messages[messageIndex - 1];
      if (!userMessage || userMessage.role !== "user") {
        console.error("Could not find user message to regenerate from");
        return;
      }

      const modelToUse = newModel || selectedModel;
      if (newModel && newModel !== selectedModel) {
        await changeModel(newModel);
      }

      // Get the root parent message ID (for version chaining)
      // If the current message already has a parent, use that parent
      // Otherwise, use the current message as the root parent
      let rootParentId = actualConvexId;
      
      // Check if this message already has a parent (it's already a regenerated version)
      const currentMessage = await convex.query(api.chat.getMessageVersions, {
        messageId: actualConvexId as Id<"messages">
      });
      
      if (currentMessage && currentMessage.length > 0) {
        // Find the root parent (the one without a parentMessageId)
        const rootMessage = currentMessage.find(msg => !msg.parentMessageId);
        if (rootMessage) {
          rootParentId = rootMessage._id;
        }
      }

      // Get the next version number from Convex using the root parent
      const nextVersion = await convex.query(api.chat.getNextVersionNumber, {
        parentMessageId: rootParentId as Id<"messages">
      });

      // If this is the first regeneration (nextVersion is 2), mark the original as version 1
      if (nextVersion === 2) {
        await convex.mutation(api.chat.markAsOriginalVersion, {
          messageId: rootParentId as Id<"messages">
        });
      }

      regenerationContext.current = {
        parentMessageId: rootParentId, // Use root parent, not immediate parent
        version: nextVersion,
      };

      // Remove assistant message and any messages after it from the UI temporarily
      const messagesToKeep = messages.slice(0, messageIndex);
      setMessages(messagesToKeep);

      // regenerate the response
      await reload({
        body: {
          chatId: chatId as Id<"chats">,
          userId: user.id,
          model: modelToUse,
          isAuthenticated: true,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
        },
      });

    } catch (error) {
      console.error("Failed to regenerate message:", error);
      regenerationContext.current = null;
      toast({
        title: "Failed to regenerate message",
        status: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, chatId, selectedModel, messages, setMessages, reload, changeModel, isSubmitting, convex]);

  return (
    <MessagesContext.Provider
      value={{
        messages,
        input,
        setInput,
        status,
        error,
        isSubmitting,
        selectedModel,
        setSelectedModel,
        sendMessage,
        createNewChat,
        changeModel,
        regenerateMessage,
        stop,
        reload,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
} 