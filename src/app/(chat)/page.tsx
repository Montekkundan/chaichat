import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Chat from "~/components/chat/chat";
import { LayoutMain } from "~/components/chat/layout-chat";
import { APP_NAME, generateOGImageURL } from "~/lib/config";
import { MessagesProvider } from "~/lib/providers/messages-provider";

export const metadata: Metadata = {
	title: `Chat - ${APP_NAME}`,
	description: "Start a new conversation with AI models. Experiment and explore different AI capabilities.",
	openGraph: {
		title: `Chat - ${APP_NAME}`,
		description: "Start a new conversation with AI models. Experiment and explore different AI capabilities.",
		images: [
			{
				url: generateOGImageURL({
					title: "Chat",
					type: 'chat',
				}),
				width: 1200,
				height: 630,
				alt: "Chat - ChaiChat",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: `Chat - ${APP_NAME}`,
		description: "Start a new conversation with AI models. Experiment and explore different AI capabilities.",
		images: [generateOGImageURL({
			title: "Chat",
			type: 'chat',
		})],
	},
};

export default async function Page({
	searchParams,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: searchParams typing varies between Next versions
	searchParams?: any;
}) {
	const user = await currentUser();
	const firstName = user?.firstName || undefined;

	return (
		<LayoutMain>
			<MessagesProvider>
				<Chat initialName={firstName} />
			</MessagesProvider>
		</LayoutMain>
	);
}
