# Model Selector

A searchable dropdown to browse and select models from LLM Gateway or AI Gateway.

## Usage

```tsx
import ModelSelector from "~/registry/blocks/model-selector/model-selector";

export default function Example() {
  const [model, setModel] = useState("");
  return (
    <ModelSelector selectedModelId={model} setSelectedModelId={setModel} />
  );
}
```

## Props

- selectedModelId: string
- setSelectedModelId: (id: string) => void
- className?: string
- source?: 'aigateway' | 'llmgateway'
- onSourceChange?: (s: 'aigateway' | 'llmgateway') => void
