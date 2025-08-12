import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicConversation } from "~/components/chat/public-conversation";
import { APP_NAME, generateOGImageURL } from "~/lib/config";

type SimpleTextPart = { type: "text"; text: string };

function truncateTitle(title: string, maxLength = 50): string {
	if (title.length <= maxLength) return title;
	return `${title.slice(0, maxLength).trim()}...`;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ chatId: string }>;
}): Promise<Metadata> {
	const { chatId } = await params;

	try {
		const data = await fetchQuery(api.chat.getPublicChat, {
			chatId: chatId as Id<"chats">,
		});

		const rawTitle = data?.chat.name || "Public Chat";
		const displayTitle = truncateTitle(rawTitle);
		const ogTitle = truncateTitle(rawTitle, 40);

		return {
			title: `${displayTitle} - ${APP_NAME}`,
			description:
				"View this public AI conversation. See how others interact with AI models.",
			openGraph: {
				title: `${displayTitle} - ${APP_NAME}`,
				description:
					"View this public AI conversation. See how others interact with AI models.",
				images: [
					{
						url: generateOGImageURL({
							title: ogTitle,
							type: "chat",
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
				description:
					"View this public AI conversation. See how others interact with AI models.",
				images: [
					generateOGImageURL({
						title: ogTitle,
						type: "chat",
					}),
				],
			},
		};
	} catch {
		// Fallback metadata if chat fetch fails
		const fallbackTitle = "Public Chat";
		return {
			title: `${fallbackTitle} - ${APP_NAME}`,
			description:
				"View this public AI conversation. See how others interact with AI models.",
			openGraph: {
				title: `${fallbackTitle} - ${APP_NAME}`,
				description:
					"View this public AI conversation. See how others interact with AI models.",
				images: [
					{
						url: generateOGImageURL({
							title: fallbackTitle,
							type: "chat",
						}),
						width: 1200,
						height: 630,
						alt: "Public Chat - ChaiChat",
					},
				],
			},
			twitter: {
				card: "summary_large_image",
				title: `${fallbackTitle} - ${APP_NAME}`,
				description:
					"View this public AI conversation. See how others interact with AI models.",
				images: [
					generateOGImageURL({
						title: fallbackTitle,
						type: "chat",
					}),
				],
			},
		};
	}
}

export default async function PublicChatPage({
	params,
}: {
	params: Promise<{ chatId: string }>;
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { chatId } = await params;
	const data = await fetchQuery(api.chat.getPublicChat, {
		chatId: chatId as Id<"chats">,
	});

	if (!data) return notFound();

	const messages = data.messages.map((m) => ({
		id: m._id as unknown as string,
		role: m.role,
		content: m.content,
		experimental_attachments: m.attachments,
		parts: [{ type: "text", text: m.content } as SimpleTextPart],
		model: m.model,
	}));

	return (
		<div className="flex h-full w-full">
			<PublicConversation messages={messages} />
		</div>
	);
}
