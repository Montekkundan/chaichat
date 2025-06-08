"use client";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PromptInputBox } from "~/components/prompt-input";
import { Button } from "~/components/ui/button";
import { db } from '~/db';

const SUGGESTIONS = [
	"Summarize this text",
	"Give me advice on a difficult conversation",
	"Brainstorm ideas for a project",
	"Analyze this data",
];

export default function Home() {
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const createChat = useMutation(api.chat.createChat);
	const addMessage = useMutation(api.chat.addMessage);
	const { user } = useUser();
	const router = useRouter();

	const handlePromptSubmit = async (value?: string) => {
		const prompt = typeof value === "string" ? value : input;
		if (!prompt.trim()) return;
		setIsLoading(true);
		try {
			const chatId = await createChat({
				name: prompt.slice(0, 30) || "New Chat",
				userId: user?.id || "anonymous",
			});
			await addMessage({
				chatId,
				userId: user?.id || "anonymous",
				role: "user",
				content: prompt,
			});
			// Only put in Dexie after Convex returns
			await db.chats.put({
				_id: chatId,
				name: prompt.slice(0, 30) || "New Chat",
				userId: user?.id || "anonymous",
				createdAt: Date.now(),
			});
			setInput("");
			router.push(`/chat/${chatId}?q=${encodeURIComponent(prompt)}`);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen w-full flex-col items-center bg-secondary">
			<div className="mx-auto flex w-full max-w-xl flex-col gap-6 pt-16">
				<h1 className="mb-4 text-center font-semibold text-2xl">
					How can I help you?
				</h1>
				<PromptInputBox
					value={input}
					onValueChange={setInput}
					onSubmit={() => handlePromptSubmit()}
					isLoading={isLoading}
				/>
				<div className="mt-4 flex flex-wrap justify-center gap-3">
					{SUGGESTIONS.map((suggestion) => (
						<Button
							key={suggestion}
							variant="outline"
							className="rounded-full px-5 py-2 text-base"
							onClick={() => handlePromptSubmit(suggestion)}
							disabled={isLoading}
						>
							{suggestion}
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}
