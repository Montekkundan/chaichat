import { currentUser } from "@clerk/nextjs/server";
import Chat from "~/components/chat/chat";
import { LayoutChat } from "~/components/chat/layout-chat";
import { MessagesProvider } from "~/lib/providers/messages-provider";

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

	let initialModel: string | undefined = undefined;
	if (searchParams) {
		const sp = await searchParams;
		if (typeof sp?.model === "string") {
			initialModel = sp.model;
		}
	}

	return (
		<LayoutChat>
			<MessagesProvider chatId={chatId} initialModel={initialModel}>
				<Chat initialName={firstName} />
			</MessagesProvider>
		</LayoutChat>
	);
}
