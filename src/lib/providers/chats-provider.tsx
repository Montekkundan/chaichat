"use client";

import { createContext, useContext } from "react";
import { useCache } from "./cache-provider";

type Chat = {
  _id: string;
  name: string;
  userId: string;
  currentModel: string;
  initialModel: string;
  createdAt: number;
  _creationTime: number;
};

interface ChatsContextType {
  chats: Chat[];
  refresh: () => Promise<void>;
  isLoading: boolean;
  updateTitle: (id: string, title: string) => Promise<void>;
  deleteChat: (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => Promise<void>;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  createNewChat: (
    title?: string,
    model?: string
  ) => Promise<string | undefined>;
  resetChats: () => void;
  getChatById: (id: string) => Chat | undefined;
  updateChatModel: (id: string, model: string) => Promise<void>;
}

const ChatsContext = createContext<ChatsContextType | null>(null);

export function useChats() {
  const context = useContext(ChatsContext);
  if (!context) throw new Error("useChats must be used within ChatsProvider");
  return context;
}

export function ChatsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cache = useCache();

  const refresh = async () => {
    await cache.refreshCache();
  };

  const updateTitle = async (id: string, title: string) => {
    // TODO: Implement updateChatTitle mutation in Convex when needed
    console.log("Update title not implemented yet:", id, title);
  };

  const deleteChat = async (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => {
    await cache.deleteChat(id);
    if (id === currentChatId && redirect) {
      redirect();
    }
  };

  const createNewChat = async (
    title?: string,
    model?: string
  ): Promise<string | undefined> => {
    try {
      return await cache.createChat(title || "New Chat", model || "gpt-4o");
    } catch (error) {
      console.error("Failed to create chat:", error);
      return undefined;
    }
  };

  const resetChats = () => {
    // This will be handled by the cache provider
    cache.refreshCache();
  };

  const getChatById = (id: string) => {
    return cache.getChat(id);
  };

  const updateChatModel = async (id: string, model: string) => {
    await cache.updateChatModel(id, model);
  };

  // Mock setter for compatibility - the cache provider manages state
  const setChats = () => {
    console.warn("setChats is deprecated, use cache provider methods instead");
  };

  return (
    <ChatsContext.Provider
      value={{
        chats: cache.chats,
        refresh,
        updateTitle,
        deleteChat,
        setChats,
        createNewChat,
        resetChats,
        getChatById,
        updateChatModel,
        isLoading: cache.isLoading,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
} 