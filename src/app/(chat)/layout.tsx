import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import ChatLayoutClient from "./layout-client";

export default async function ChatLayout({
	children,
}: { children: ReactNode }) {
	const user = await currentUser();
	const minimalUser = user
		? {
				id: user.id,
				firstName: user.firstName,
				fullName: user.fullName,
				imageUrl: user.imageUrl,
			}
		: undefined;

  // Keep SSR and client hydration in sync for sidebar open state
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("sidebar_state")?.value;
  const defaultSidebarOpen = sidebarCookie ? sidebarCookie === "true" : true;

	return (
		<ChatLayoutClient
			initialUser={minimalUser}
			defaultSidebarOpen={defaultSidebarOpen}
		>
			{children}
		</ChatLayoutClient>
	);
}
