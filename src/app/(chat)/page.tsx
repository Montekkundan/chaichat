"use client";
import { useState } from "react";
import { PromptInputBox } from "~/components/prompt-input";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "~/components/ui/button";

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
			setInput("");
			router.push(`/chat/${chatId}?q=${encodeURIComponent(prompt)}`);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex flex-col items-center w-full bg-secondary min-h-screen">
			<div className="w-full max-w-xl flex flex-col gap-6 mx-auto pt-16">
				<h1 className="text-2xl font-semibold text-center mb-4">How can I help you?</h1>
				<PromptInputBox
					value={input}
					onValueChange={setInput}
					onSubmit={() => handlePromptSubmit()}
					isLoading={isLoading}
				/>
				<div className="flex flex-wrap justify-center gap-3 mt-4">
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


