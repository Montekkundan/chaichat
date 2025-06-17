import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { PublicConversation } from "~/components/chat/public-conversation";

type SimpleTextPart = { type: "text"; text: string };

export default async function PublicChatPage({
	params,
}: { params: { chatId: string } }) {
	const { chatId } = params;
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
