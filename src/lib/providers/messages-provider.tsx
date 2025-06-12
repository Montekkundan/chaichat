"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import type { Message as MessageAISDK } from "ai";
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { toast } from "~/components/ui/toast";
import { API_ROUTE_CHAT } from "~/lib/routes";
import { SYSTEM_PROMPT_DEFAULT } from "~/lib/config";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  
  const chatIdConvex = chatId as Id<"chats"> | undefined;
  
  // Convex queries and mutations
  const convexMessages = useQuery(
    api.chat.getMessages,
    chatIdConvex ? { chatId: chatIdConvex } : "skip"
  );
  const addMessage = useMutation(api.chat.addMessage);
  const createChat = useMutation(api.chat.createChat);

  // Transform Convex messages for AI SDK
  const initialMessages = convexMessages?.map((m) => ({
    id: m._id,
    role: m.role,
    content: m.content,
  })) ?? [];

  // AI SDK useChat hook
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
      if (!chatIdConvex || !user?.id) return;

      // Store assistant message in Convex
      if (message.role === "assistant") {
        await addMessage({
          chatId: chatIdConvex,
          userId: "assistant", 
          role: "assistant",
          content: message.content,
        });
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

  // Sync Convex messages to AI SDK when chat loads
  useEffect(() => {
    if (convexMessages && status === "ready") {
      setMessages(
        convexMessages.map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
        }))
      );
    }
  }, [convexMessages, setMessages, status]);

  // Reset messages when chatId changes to null
  useEffect(() => {
    if (chatId === null) {
      setMessages([]);
    }
    // Reset pending input flag when chatId changes
    hasAppendedPending.current = false;
  }, [chatId, setMessages]);

  const createNewChat = async (initialMessage: string, model: string): Promise<string> => {
    if (!user?.id) throw new Error("User not authenticated");
    
    const chatName = initialMessage.slice(0, 50);
    const newChatId = await createChat({
      name: chatName,
      userId: user.id,
      model: model,
    });
    
    return newChatId;
  };

  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || !user?.id || !chatIdConvex) return;
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const submitOptions = {
        body: {
          chatId: chatIdConvex,
          userId: user.id,
          model: selectedModel,
          isAuthenticated: true,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
        },
      };

      // Save user message to Convex for persistence
      await addMessage({
        chatId: chatIdConvex,
        userId: user.id,
        role: "user",
        content: messageContent,
      });

      // Use append method to trigger AI response
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
  }, [user?.id, chatIdConvex, selectedModel, append, isSubmitting, addMessage]);

  // Handle pending input from URL params (homepage → chat flow)
  const hasAppendedPending = useRef(false);
  const hasSentPending = useRef(false);
  const [pendingInputToSend, setPendingInputToSend] = useState<string | null>(null);
  
  // Extract pending input from URL and store it
  useEffect(() => {
    if (typeof window !== "undefined" && !hasAppendedPending.current) {
      const url = new URL(window.location.href);
      const pendingInput = url.searchParams.get("q");
      
      if (pendingInput) {
        setPendingInputToSend(pendingInput);
        hasAppendedPending.current = true;
        
        // Clean up URL
        url.searchParams.delete("q");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    }
  }, []);
  
  // Send pending input when component is ready
  useEffect(() => {
    if (pendingInputToSend && chatIdConvex && user?.id && status === "ready" && messages.length === 0 && !hasSentPending.current) {
      hasSentPending.current = true;
      
      setTimeout(() => {
        sendMessage(pendingInputToSend);
        setPendingInputToSend(null);
      }, 300);
    }
  }, [pendingInputToSend, chatIdConvex, user?.id, status, messages.length, sendMessage]);
  
  // Reset flags when chatId changes
  useEffect(() => {
    hasSentPending.current = false;
  }, []);

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
        stop,
        reload,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
} 