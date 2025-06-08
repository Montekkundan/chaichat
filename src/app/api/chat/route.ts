import { openai } from "@ai-sdk/openai";
import { type UIMessage, streamText } from "ai";

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const result = streamText({
		model: openai("gpt-4o"),
		system: "You are a helpful assistant.",
		messages,
	});

	return result.toDataStreamResponse();
}
