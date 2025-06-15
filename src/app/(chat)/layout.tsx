import type { ReactNode } from "react";
import { currentUser } from "@clerk/nextjs/server";
import ChatLayoutClient from "./layout-client";

export default async function ChatLayout({ children }: { children: ReactNode }) {
	const user = await currentUser();
	const minimalUser = user ? {
		id: user.id,
		firstName: user.firstName,
		fullName: user.fullName,
		imageUrl: user.imageUrl,
	} : undefined;

	return <ChatLayoutClient initialUser={minimalUser}>{children}</ChatLayoutClient>;
}