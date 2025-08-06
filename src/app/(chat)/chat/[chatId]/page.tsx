import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { currentUser } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Chat from "~/components/chat/chat";
import { LayoutMain } from "~/components/chat/layout-chat";
import { ChatTitleSyncer } from "~/components/chat-title-syncer";
import { ChatTitlesCookieManager } from "~/lib/chat-titles-cookie";
import { APP_NAME, generateOGImageURL } from "~/lib/config";
import { MessagesProvider } from "~/lib/providers/messages-provider";

function truncateTitle(title: string, maxLength: number = 50): string {
	if (title.length <= maxLength) return title;
	return title.slice(0, maxLength).trim() + "...";
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ chatId: string }>;
}): Promise<Metadata> {
	const { chatId } = await params;
	
	let chatTitle = "Chat";
	
	try {
		const user = await currentUser();
		const userId = user?.id;
		
		if (userId) {
			// For logged-in users: fetch from Convex
			const chats = await fetchQuery(api.chat.listChats, { userId });
			const chat = chats.find(c => c._id === chatId);
			if (chat?.name) {
				chatTitle = chat.name;
			}
		} else {
			// For non-logged-in users: try to get title from cookies
			const cookieStore = await cookies();
			const chatTitlesCookie = cookieStore.get('cc_chat_titles')?.value;
			const titleFromCookie = ChatTitlesCookieManager.getChatTitle(chatId, chatTitlesCookie);
			if (titleFromCookie) {
				chatTitle = titleFromCookie;
			}
		}
	} catch (error) {
		// Fallback to default title if fetch fails
		console.warn("Failed to fetch chat title:", error);
	}
	
	// Truncate title for display
	const displayTitle = truncateTitle(chatTitle);
	const ogTitle = truncateTitle(chatTitle, 40);
	
	return {
		title: `${displayTitle} - ${APP_NAME}`,
		description: "Continue your AI conversation. Explore different AI models and capabilities.",
		openGraph: {
			title: `${displayTitle} - ${APP_NAME}`,
			description: "Continue your AI conversation. Explore different AI models and capabilities.",
			images: [
				{
					url: generateOGImageURL({
						title: ogTitle,
						type: 'chat',
					}),
					width: 1200,
					height: 630,
					alt: `${displayTitle} - ChaiChat`,
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: `${displayTitle} - ${APP_NAME}`,
			description: "Continue your AI conversation. Explore different AI models and capabilities.",
			images: [generateOGImageURL({
				title: ogTitle,
				type: 'chat',
			})],
		},
	};
}

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ chatId: string }>;
	searchParams?: Promise<{ model?: string }>;
}) {
	const { chatId } = await params;

	const user = await currentUser();
	const firstName = user?.firstName || undefined;

	return (
		<LayoutMain>
			<ChatTitleSyncer chatId={chatId} />
			<MessagesProvider chatId={chatId}>
				<Chat initialName={firstName} />
			</MessagesProvider>
		</LayoutMain>
	);
}
