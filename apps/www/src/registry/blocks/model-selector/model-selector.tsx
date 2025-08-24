"use client";

import { useState } from "react";
import { ModelSelector as RealModelSelector } from "~/components/chat-input/model-selector";

export default function ModelSelectorBlock() {
	const [selectedModelId, setSelectedModelId] = useState("");
	const [source, setSource] = useState<"aigateway" | "llmgateway">(
		"llmgateway",
	);

	return (
		<div className="w-full max-w-[360px]">
			<RealModelSelector
				selectedModelId={selectedModelId}
				setSelectedModelId={setSelectedModelId}
				className="w-full"
				source={source}
				onSourceChange={setSource}
			/>
		</div>
	);
}

export { RealModelSelector as ModelSelector };


