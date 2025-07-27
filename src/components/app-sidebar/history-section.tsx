"use client"

import { History, MessageSquare, GitBranch, Share2, X } from "lucide-react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { localChatStorage, type LocalChat } from "~/lib/local-chat-storage"
import { useUser } from "@clerk/nextjs"
import { useCache } from "~/lib/providers/cache-provider"
import { userSessionManager } from "~/lib/user-session-manager"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { HistoryDialog } from "./history-dialog"

export function HistorySection() {
  const { user } = useUser();
  const cache = useCache();
  const router = useRouter();
  const [recentChats, setRecentChats] = useState<LocalChat[]>([]);
  const [chatCount, setChatCount] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  useEffect(() => {
    const loadRecentChats = async () => {
      if (!user) {
        // For non-logged users, load from local storage
        const storageUserId = userSessionManager.getStorageUserId();
        const chats = await localChatStorage.getRecentChats(3, storageUserId);
        const count = await localChatStorage.getChatCount(storageUserId);
        setRecentChats(chats);
        setChatCount(count);
      } else {
        // For logged users, load from both cache and local storage
        const [cacheChats, localChats] = await Promise.all([
          Promise.resolve(cache.chats.slice(0, 3)),
          localChatStorage.getRecentChats(3, user.id)
        ]);
        
        // Merge chats, prioritizing cache chats (they're more up-to-date)
        const chatMap = new Map();
        
        // Add local chats first
        for (const chat of localChats) {
          chatMap.set(chat._id, chat);
        }
        
        // Override with cache chats
        for (const chat of cacheChats) {
          chatMap.set(chat._id, {
            ...chat,
            id: chat._id,
          });
        }
        
        const mergedChats = Array.from(chatMap.values()).sort((a, b) => b.createdAt - a.createdAt);
        setRecentChats(mergedChats.slice(0, 3));
        setChatCount(cache.chats.length); // Use cache count as primary
      }
    };

    loadRecentChats();
    
    // Set up faster refresh for both logged and non-logged users
    const interval = setInterval(loadRecentChats, 500); // Refresh every 500ms for faster updates
    return () => clearInterval(interval);
  }, [user, cache.chats]);

  const handleDeleteClick = (chatId: string) => {
    setChatToDelete(chatId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete) return;

    try {
      if (!user) {
        await localChatStorage.deleteChat(chatToDelete);
        // Reload chats
        const storageUserId = userSessionManager.getStorageUserId();
        const chats = await localChatStorage.getRecentChats(3, storageUserId);
        const count = await localChatStorage.getChatCount(storageUserId);
        setRecentChats(chats);
        setChatCount(count);
      } else {
        // For logged users, delete from both cache and local storage
        await Promise.all([
          cache.deleteChat(chatToDelete),
          localChatStorage.deleteChat(chatToDelete)
        ]);
      }
      
      // Navigate to home page
      router.push("/");
    } catch (error) {
      console.error("Failed to delete chat:", error);
    } finally {
      setDeleteDialogOpen(false);
      setChatToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>History ({chatCount})</SidebarGroupLabel>
        <SidebarMenu>
          {chatCount === 0 ? (
            <SidebarMenuItem>
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No chats yet
              </div>
            </SidebarMenuItem>
          ) : (
            <>
              {recentChats.map((chat) => (
                <SidebarMenuItem key={chat.id} className="group/chat">
                  <SidebarMenuButton asChild>
                    <Link href={`/chat/${chat.id}`} className="flex items-center gap-2">
                      {chat.parentChatId ? (
                        <GitBranch className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                      <span className="flex-1 truncate">{chat.name}</span>
                      {chat.isPublic && (
                        <span className="text-muted-foreground text-xs">Public</span>
                      )}
                    </Link>
                  </SidebarMenuButton>

                  {/* Action buttons */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover/chat:flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        // Handle share functionality
                      }}
                      aria-label="Share chat"
                    >
                      <Share2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteClick(chat.id);
                      }}
                      aria-label="Delete chat"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </SidebarMenuItem>
              ))}
              
              {chatCount > 3 && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setIsDialogOpen(true)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <History className="h-4 w-4" />
                    <span>See all ({chatCount})</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </>
          )}
        </SidebarMenu>
      </SidebarGroup>

      <HistoryDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen}
        isLoggedIn={!!user}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
