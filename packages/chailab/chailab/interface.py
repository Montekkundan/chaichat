"""ChaiLab Interface - Gradio-like interface using shadcn/ui components."""

from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any, Callable, Iterable, List, Sequence

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from .blocks import Blocks
from .ui import Component, component_registry, Text


def _ensure_sequence(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return list(value)
    return [value]


class Interface(Blocks):
    """Shadcn-powered analogue to ``gradio.Interface``."""

    def __init__(
        self,
        fn: Callable,
        inputs: Sequence[str | Component] | str | Component | None = None,
        outputs: Sequence[str | Component] | str | Component | None = None,
        *,
        title: str = "ChaiLab Demo",
        description: str = "",
        theme: str = "default",
    ) -> None:
        super().__init__(title=title, description=description, theme=theme)
        self.fn = fn
        self.inputs = self._normalise_components(inputs, role="input")
        self.outputs = self._normalise_components(outputs, role="output")

    # ------------------------------------------------------------------
    # Component helpers
    # ------------------------------------------------------------------
    def _normalise_components(
        self,
        components: Sequence[str | Component] | str | Component | None,
        *,
        role: str,
    ) -> List[Component]:
        normalised: List[Component] = []
        for index, comp in enumerate(_ensure_sequence(components)):
            instance = self._coerce_component(comp, role=role, index=index)
            normalised.append(instance)
        return normalised

    def _coerce_component(self, component: str | Component, *, role: str, index: int) -> Component:
        if isinstance(component, Component):
            return component
        if isinstance(component, str):
            try:
                component_cls = component_registry.resolve(component)
            except (KeyError, TypeError):
                if role == "output" and component.lower() in {"text", "textbox", "output"}:
                    component_cls = Text
                else:
                    raise ValueError(f"Unknown component specification '{component}' for {role} #{index + 1}")
            return component_cls()
        if inspect.isclass(component) and issubclass(component, Component):
            return component()
        raise TypeError(f"Unsupported component type: {component!r}")

    def _build_component_configs(self) -> dict[str, List[dict[str, Any]]]:
        configs = {"inputs": [], "outputs": []}
        for idx, component in enumerate(self.inputs):
            configs["inputs"].append(
                component.to_config(
                    component_id=f"input_{idx}",
                    label=component.props.get("label") or f"Input {idx + 1}",
                )
            )
        for idx, component in enumerate(self.outputs):
            configs["outputs"].append(
                component.to_config(
                    component_id=f"output_{idx}",
                    label=component.props.get("label") or f"Output {idx + 1}",
                )
            )
        return configs

    # ------------------------------------------------------------------
    # FastAPI application construction
    # ------------------------------------------------------------------
    def _create_app(self):
        app = FastAPI(title=self.title, description=self.description)
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.get("/", response_class=HTMLResponse)
        async def root():
            return self._render_html()

        @app.get("/config")
        async def config():
            return {
                "title": self.title,
                "description": self.description,
                "theme": self.theme,
                "components": self._build_component_configs(),
            }

        @app.post("/api/predict")
        async def predict(request: Request):
            payload = await request.json()
            inputs = payload.get("inputs", [])
            if not isinstance(inputs, list):
                return JSONResponse({"success": False, "error": "Inputs must be a list."}, status_code=400)
            try:
                outputs = await self._execute(inputs)
            except Exception as exc:  # pragma: no cover - surface runtime error
                return JSONResponse({"success": False, "error": str(exc)}, status_code=500)
            return {"success": True, "outputs": outputs}

        return app

    async def _execute(self, inputs: List[Any]) -> List[Any]:
        args = inputs
        fn = self.fn

        if inspect.iscoroutinefunction(fn):
            result = await fn(*args)
        else:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                result = await loop.run_in_executor(None, lambda: fn(*args))
            else:
                result = fn(*args)

        if inspect.isasyncgen(result):
            result = [item async for item in result]
        elif inspect.isgenerator(result):
            result = list(result)

        if not isinstance(result, (list, tuple)):
            result = [result]
        return list(result)

    # ------------------------------------------------------------------
    # Rendering helpers
    # ------------------------------------------------------------------
    def _render_html(self) -> str:
        config = {
            "title": self.title,
            "description": self.description,
            "components": self._build_component_configs(),
        }
        config_json = json.dumps(config)

        return f"""
        <!DOCTYPE html>
        <html lang=\"en\">
        <head>
            <meta charset=\"UTF-8\" />
            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
            <title>{self.title}</title>
            <script src=\"https://cdn.tailwindcss.com\"></script>
            <script>
                tailwind.config = {{
                    theme: {{
                        extend: {{
                            colors: {{
                                border: 'hsl(var(--border))',
                                input: 'hsl(var(--input))',
                                ring: 'hsl(var(--ring))',
                                background: 'hsl(var(--background))',
                                foreground: 'hsl(var(--foreground))',
                                primary: {{
                                    DEFAULT: 'hsl(var(--primary))',
                                    foreground: 'hsl(var(--primary-foreground))'
                                }},
                                secondary: {{
                                    DEFAULT: 'hsl(var(--secondary))',
                                    foreground: 'hsl(var(--secondary-foreground))'
                                }},
                                destructive: {{
                                    DEFAULT: 'hsl(var(--destructive))',
                                    foreground: 'hsl(var(--destructive-foreground))'
                                }},
                                muted: {{
                                    DEFAULT: 'hsl(var(--muted))',
                                    foreground: 'hsl(var(--muted-foreground))'
                                }},
                                accent: {{
                                    DEFAULT: 'hsl(var(--accent))',
                                    foreground: 'hsl(var(--accent-foreground))'
                                }},
                                card: {{
                                    DEFAULT: 'hsl(var(--card))',
                                    foreground: 'hsl(var(--card-foreground))'
                                }}
                            }},
                            borderRadius: {{
                                lg: 'var(--radius)',
                                md: 'calc(var(--radius) - 2px)',
                                sm: 'calc(var(--radius) - 4px)'
                            }}
                        }}
                    }}
                }}
            </script>
            <script src=\"https://unpkg.com/react@18/umd/react.development.js\"></script>
            <script src=\"https://unpkg.com/react-dom@18/umd/react-dom.development.js\"></script>
            <script src=\"https://unpkg.com/@babel/standalone/babel.min.js\"></script>
            <style>
                :root {{
                    --background: 0 0% 100%;
                    --foreground: 222.2 84% 4.9%;
                    --card: 0 0% 100%;
                    --card-foreground: 222.2 84% 4.9%;
                    --popover: 0 0% 100%;
                    --popover-foreground: 222.2 84% 4.9%;
                    --primary: 222.2 47.4% 11.2%;
                    --primary-foreground: 210 40% 98%;
                    --secondary: 210 40% 96%;
                    --secondary-foreground: 222.2 47.4% 11.2%;
                    --muted: 210 40% 96%;
                    --muted-foreground: 215.4 16.3% 46.9%;
                    --accent: 210 40% 96%;
                    --accent-foreground: 222.2 47.4% 11.2%;
                    --destructive: 0 84.2% 60.2%;
                    --destructive-foreground: 210 40% 98%;
                    --border: 214.3 31.8% 91.4%;
                    --input: 214.3 31.8% 91.4%;
                    --ring: 222.2 84% 4.9%;
                    --radius: 0.5rem;
                }}
            </style>
        </head>
        <body class=\"min-h-screen bg-background py-6\">
            <div id=\"app\" class=\"container mx-auto max-w-4xl px-4\"></div>
            <script type=\"text/babel\">
                const interfaceConfig = {config_json};

                function useInitialInputState() {{
                    const state = {{}};
                    interfaceConfig.components.inputs.forEach((config) => {{
                        if (config.type === 'slider') {{
                            const value = Array.isArray(config.props.value) ? config.props.value[0] : (config.props.value ?? config.props.min ?? 0);
                            state[config.id] = value;
                        }} else {{
                            state[config.id] = config.props.value ?? '';
                        }}
                    }});
                    return state;
                }}

                function InputComponent({{ config, value, onChange }}) {{
                    if (config.type === 'input') {{
                        return (
                            <div className=\"space-y-2\">
                                <label className=\"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70\">
                                    {{config.label}}
                                </label>
                                <input
                                    type={{config.props.type || 'text'}}
                                    placeholder={{config.props.placeholder || ''}}
                                    value={{value}}
                                    disabled={{config.props.disabled}}
                                    className=\"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50\"
                                    onChange={{(event) => onChange(event.target.value)}}
                                />
                                {{config.props.error ? (
                                    <p className=\"text-sm text-destructive\">{{config.props.error}}</p>
                                ) : null}}
                            </div>
                        );
                    }}

                    if (config.type === 'slider') {{
                        return (
                            <div className=\"space-y-4\">
                                <div className=\"flex items-center justify-between\">
                                    <label className=\"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70\">
                                        {{config.label}}
                                    </label>
                                    <span className=\"text-sm text-muted-foreground\">{{value}}</span>
                                </div>
                                <input
                                    type=\"range\"
                                    min={{config.props.min ?? 0}}
                                    max={{config.props.max ?? 100}}
                                    step={{config.props.step ?? 1}}
                                    value={{value}}
                                    disabled={{config.props.disabled}}
                                    onChange={{(event) => onChange(parseFloat(event.target.value))}}
                                    className=\"w-full h-2 rounded-lg bg-secondary\"
                                />
                            </div>
                        );
                    }}

                    return (
                        <div className=\"space-y-2\">
                            <label className=\"text-sm font-medium leading-none\">{{config.label}}</label>
                            <div className=\"text-sm text-muted-foreground\">Unsupported input: {{config.type}}</div>
                        </div>
                    );
                }}

                function OutputComponent({{ config, value }}) {{
                    return (
                        <div className=\"space-y-2\">
                            <label className=\"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70\">
                                {{config.label}}
                            </label>
                            <div className=\"flex min-h-[40px] w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background\">
                                {{value ?? config.props.placeholder ?? 'Output will appear here'}}
                            </div>
                        </div>
                    );
                }}

                function App() {{
                    const [inputValues, setInputValues] = React.useState(() => useInitialInputState());
                    const [outputs, setOutputs] = React.useState([]);
                    const [isLoading, setIsLoading] = React.useState(false);
                    const [error, setError] = React.useState(null);

                    const handleChange = (id, nextValue) => {{
                        setInputValues((prev) => ({{ ...prev, [id]: nextValue }}));
                    }};

                    const handleSubmit = async () => {{
                        const payload = interfaceConfig.components.inputs.map((config) => inputValues[config.id]);
                        setIsLoading(true);
                        setError(null);
                        try {{
                            const response = await fetch('/api/predict', {{
                                method: 'POST',
                                headers: {{ 'Content-Type': 'application/json' }},
                                body: JSON.stringify({{ inputs: payload }}),
                            }});
                            const data = await response.json();
                            if (data.success) {{
                                setOutputs(data.outputs);
                            }} else {{
                                setError(data.error || 'Unknown error');
                            }}
                        }} catch (err) {{
                            setError(err.message);
                        }} finally {{
                            setIsLoading(false);
                        }}
                    }};

                    return (
                        <div className=\"space-y-6\">
                            <div className=\"rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-6\">
                                <div className=\"space-y-2\">
                                    <h1 className=\"text-2xl font-semibold\">{{interfaceConfig.title}}</h1>
                                    {{interfaceConfig.description ? (
                                        <p className=\"text-muted-foreground\">{{interfaceConfig.description}}</p>
                                    ) : null}}
                                </div>

                                <div className=\"grid grid-cols-1 gap-6 md:grid-cols-2\">
                                    <div className=\"space-y-4\">
                                        <h3 className=\"text-lg font-medium\">Inputs</h3>
                                        {{interfaceConfig.components.inputs.map((config) => (
                                            <InputComponent
                                                key={{config.id}}
                                                config={{config}}
                                                value={{inputValues[config.id]}}
                                                onChange={{(value) => handleChange(config.id, value)}}
                                            />
                                        ))}}
                                    </div>
                                    <div className=\"space-y-4\">
                                        <h3 className=\"text-lg font-medium\">Outputs</h3>
                                        {{interfaceConfig.components.outputs.map((config, index) => (
                                            <OutputComponent
                                                key={{config.id}}
                                                config={{config}}
                                                value={{outputs[index]}}
                                            />
                                        ))}}
                                    </div>
                                </div>

                                <div className=\"flex items-center justify-between\">
                                    {{error ? (
                                        <p className=\"text-sm text-destructive\">{{error}}</p>
                                    ) : <span />}}
                                    <button
                                        onClick={{handleSubmit}}
                                        disabled={{isLoading}}
                                        className=\"inline-flex items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50\"
                                    >
                                        {{isLoading ? 'Running…' : 'Submit'}}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                }}

                const root = ReactDOM.createRoot(document.getElementById('app'));
                root.render(<App />);
            </script>
        </body>
        </html>
        """

    # ------------------------------------------------------------------
    # Public helpers
    # ------------------------------------------------------------------
    def integrate(self, wandb=None, **kwargs):  # pragma: no cover - placeholder hook
        if wandb is not None:
            print("✅ W&B integration ready")
        return self


__all__ = ["Interface"]
