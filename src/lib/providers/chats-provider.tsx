"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "~/components/ui/toast";
import { MODEL_DEFAULT } from "~/lib/config";

type Chat = {
  _id: Id<"chats">;
  name: string;
  userId: string;
  model: string;
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
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);

  // Convex queries and mutations
  const convexChats = useQuery(
    api.chat.listChats,
    user?.id ? { userId: user.id } : "skip"
  );
  const createChatMutation = useMutation(api.chat.createChat);
  const deleteChatMutation = useMutation(api.chat.deleteChat);

  // Sync Convex chats to local state
  useEffect(() => {
    if (convexChats) {
      setChats(convexChats as Chat[]);
      setIsLoading(false);
    } else if (user?.id) {
      setIsLoading(true);
    }
  }, [convexChats, user?.id]);

  const refresh = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    // Convex will automatically refresh the query
    setIsLoading(false);
  };

  const updateTitle = async (id: string, title: string) => {
    const prev = [...chats];
    setChats((prev) => prev.map((c) => (c._id === id ? { ...c, name: title } : c)));
    
    try {
      // TODO: Implement updateChatTitle mutation in Convex
      // await updateChatTitleMutation({ chatId: id as Id<"chats">, title });
      console.log("Update title not implemented yet:", id, title);
    } catch (error) {
      setChats(prev);
      toast({ title: "Failed to update title", status: "error" });
    }
  };

  const deleteChat = async (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => {
    const prev = [...chats];
    setChats((prev) => prev.filter((c) => c._id !== id));

    try {
      await deleteChatMutation({ chatId: id as Id<"chats"> });
      if (id === currentChatId && redirect) {
        redirect();
      }
    } catch (error) {
      setChats(prev);
      toast({ title: "Failed to delete chat", status: "error" });
    }
  };

  const createNewChat = async (
    title?: string,
    model?: string
  ): Promise<string | undefined> => {
    if (!user?.id) return;

    const optimisticId = `optimistic-${Date.now().toString()}`;
    const optimisticChat: Chat = {
      _id: optimisticId as Id<"chats">,
      name: title || "New Chat",
      userId: user.id,
      model: model || MODEL_DEFAULT,
      createdAt: Date.now(),
      _creationTime: Date.now(),
    };

    setChats((prev) => [optimisticChat, ...prev]);

    try {
      const newChatId = await createChatMutation({
        name: title || "New Chat",
        userId: user.id,
        model: model || MODEL_DEFAULT,
      });

      // Replace optimistic chat with real one
      setChats((prev) =>
        prev.map((c) => (c._id === optimisticId ? { ...optimisticChat, _id: newChatId } : c))
      );

      return newChatId;
    } catch (error) {
      // Remove optimistic chat on error
      setChats((prev) => prev.filter((c) => c._id !== optimisticId));
      toast({ title: "Failed to create chat", status: "error" });
    }
  };

  const resetChats = () => {
    setChats([]);
  };

  const getChatById = (id: string) => {
    return chats.find((c) => c._id === id);
  };

  const updateChatModel = async (id: string, model: string) => {
    const prev = [...chats];
    setChats((prev) => prev.map((c) => (c._id === id ? { ...c, model } : c)));

    try {
      // TODO: Implement updateChatModel mutation in Convex
      // await updateChatModelMutation({ chatId: id as Id<"chats">, model });
      console.log("Update model not implemented yet:", id, model);
    } catch (error) {
      setChats(prev);
      toast({ title: "Failed to update model", status: "error" });
    }
  };

  return (
    <ChatsContext.Provider
      value={{
        chats,
        refresh,
        updateTitle,
        deleteChat,
        setChats,
        createNewChat,
        resetChats,
        getChatById,
        updateChatModel,
        isLoading,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
} 