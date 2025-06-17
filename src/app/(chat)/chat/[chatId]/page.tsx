import { currentUser } from "@clerk/nextjs/server";
import Chat from "~/components/chat/chat";
import { LayoutChat } from "~/components/chat/layout-chat";
import { MessagesProvider } from "~/lib/providers/messages-provider";

export default async function Page({ params, searchParams }: { params: { chatId: string }; searchParams?: { model?: string } }) {
	const { chatId } = params;
	const user = await currentUser();
	const firstName = user?.firstName || undefined;
	const initialModel = searchParams?.model;

	return (
		<LayoutChat>
			<MessagesProvider chatId={chatId} initialModel={initialModel}>
				<Chat initialName={firstName} />
			</MessagesProvider>
		</LayoutChat>
	);
}
