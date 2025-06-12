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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModel, setSelectedModel] = useState(initialModel);
  
  // Track regeneration context - use useRef to persist across re-renders
  const regenerationContext = useRef<{
    parentMessageId: string;
    version: number;
  } | null>(null);
  
  const chatIdConvex = chatId as Id<"chats"> | undefined;
  
  // Convex queries and mutations
  const convexMessages = useQuery(
    api.chat.getMessages,
    chatIdConvex ? { chatId: chatIdConvex } : "skip"
  );
  const addMessage = useMutation(api.chat.addMessage);
  const createChat = useMutation(api.chat.createChat);
  const updateChatModel = useMutation(api.chat.updateChatModel);
  const markAsOriginalVersion = useMutation(api.chat.markAsOriginalVersion);

  // Transform Convex messages for AI SDK
  const initialMessages = convexMessages?.map((m) => ({
    id: m._id,
    role: m.role,
    content: m.content,
    model: m.model, // Include model in message data
    convexId: m._id, // Keep track of the Convex ID for versioning
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
        try {
          // Check if this is a regenerated message
          if (regenerationContext.current) {
            // Mark the original message as version 1 if this is the first regeneration
            await markAsOriginalVersion({ 
              messageId: regenerationContext.current.parentMessageId as Id<"messages"> 
            });

            // This is a regenerated message - create version with parent relationship
            const convexMessageId = await addMessage({
              chatId: chatIdConvex,
              userId: "assistant", 
              role: "assistant",
              content: message.content,
              model: selectedModel,
              parentMessageId: regenerationContext.current.parentMessageId as Id<"messages">,
              version: regenerationContext.current.version,
            });

            // Update the AI SDK message with the convexId
            setMessages(currentMessages => 
              currentMessages.map(msg => 
                msg.id === message.id 
                  ? { ...msg, convexId: convexMessageId }
                  : msg
              )
            );

            // Clear regeneration context
            regenerationContext.current = null;
          } else {
            // This is a new original message
            const convexMessageId = await addMessage({
              chatId: chatIdConvex,
              userId: "assistant", 
              role: "assistant",
              content: message.content,
              model: selectedModel,
            });

            // Update the AI SDK message with the convexId for version tracking
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
          // Clear regeneration context on error
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

  // Sync Convex messages to AI SDK when chat loads
  useEffect(() => {
    if (convexMessages && status === "ready") {
      setMessages(
        convexMessages.map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
          convexId: m._id, // Preserve Convex ID for version tracking
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

  const changeModel = useCallback(async (model: string): Promise<void> => {
    setSelectedModel(model);
    
    // Update the chat's current model if we have a chatId
    if (chatIdConvex) {
      await updateChatModel({
        chatId: chatIdConvex,
        model: model,
      });
    }
  }, [chatIdConvex, updateChatModel]);

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
        model: selectedModel,
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

  const regenerateMessage = useCallback(async (messageIndex: number, newModel?: string) => {
    if (!user?.id || !chatIdConvex || messageIndex < 0) return;
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Find the assistant message to regenerate
      const assistantMessage = messages[messageIndex];
      
      if (!assistantMessage || assistantMessage.role !== "assistant") {
        console.error("Could not find assistant message to regenerate");
        return;
      }

      // Get the convexId from the message
      const convexId = (assistantMessage as MessageAISDK & { convexId?: string }).convexId;
      
      // For existing messages without convexId, use the message ID (which should be the Convex ID)
      const actualConvexId = convexId || assistantMessage.id;
      
      if (!actualConvexId) {
        console.error("No ID found for message - cannot regenerate");
        return;
      }

      // Find the user message that prompted this assistant response
      const userMessage = messages[messageIndex - 1];
      if (!userMessage || userMessage.role !== "user") {
        console.error("Could not find user message to regenerate from");
        return;
      }

      // Update the model if a new one was selected
      const modelToUse = newModel || selectedModel;
      if (newModel && newModel !== selectedModel) {
        await changeModel(newModel);
      }

      // Set up regeneration context - use the actualConvexId as parent and get next version
      // For now, we'll use a simple version incrementing approach
      const nextVersion = 2; // Start with version 2 for the first regeneration

      regenerationContext.current = {
        parentMessageId: actualConvexId,
        version: nextVersion,
      };

      // Remove the assistant message and any messages after it from the UI temporarily
      const messagesToKeep = messages.slice(0, messageIndex);
      setMessages(messagesToKeep);

      // Use reload from useChat to regenerate the response
      await reload({
        body: {
          chatId: chatIdConvex,
          userId: user.id,
          model: modelToUse,
          isAuthenticated: true,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
        },
      });

    } catch (error) {
      console.error("Failed to regenerate message:", error);
      regenerationContext.current = null; // Clear context on error
      toast({
        title: "Failed to regenerate message",
        status: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user?.id, chatIdConvex, selectedModel, messages, setMessages, reload, changeModel, isSubmitting]);

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