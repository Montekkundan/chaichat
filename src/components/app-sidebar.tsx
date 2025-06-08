import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "~/components/ui/sidebar";
import { Search } from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Unauthenticated } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function AppSidebar() {
  const { user } = useUser();
  const router = useRouter();
  // Example chat list
  const chats = [
    { id: 1, name: "Greeting" },
  ];

  const handleProfileClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    router.push('/settings/subscription');
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="py-1 text-center text-xl tracking-tight">ChaiChat</div>
        <Button className="cursor-pointer">
          New Chat
        </Button>
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search your threads..."
              className="w-full rounded-md border border-muted bg-background px-3 py-2 pl-10 text-sm focus:outline-none"
            />
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Today</div>
          <SidebarMenu>
            {chats.map((chat) => (
              <SidebarMenuItem key={chat.id}>
                <SidebarMenuButton asChild>
                  <Link href={`/chat/${chat.id}`}>
                    <span>{chat.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <button
            type="button"
            className="flex items-center gap-3 py-4 px-4 w-full cursor-pointer"
            onClick={handleProfileClick}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleProfileClick(e)}
            tabIndex={0}
          >
            <img src={user.imageUrl} alt={user.fullName || 'User'} className="h-10 w-10 rounded-full" />
            <div className="flex flex-col items-start">
              <span className="font-semibold">{user.fullName}</span>
              <span className="text-xs text-muted-foreground">Free</span>
            </div>
          </button>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Unauthenticated>
              <SignInButton />
            </Unauthenticated>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
} 