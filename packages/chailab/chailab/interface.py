"""
ChaiLab Interface - Gradio-like interface using shadcn/ui components
"""

import asyncio
import json
import threading
import uvicorn
from typing import Any, Callable, List, Union
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# from .themes import generate_theme_css


class Interface:
    """
    ChaiLab Interface - Similar to Gradio's Interface but with shadcn/ui components

    Args:
        fn: The function to create a UI for
        inputs: Input components (can be strings or shadcn/ui components)
        outputs: Output components (can be strings or shadcn/ui components)
        title: Title for the interface
        description: Description for the interface
        theme: Theme to use ('default', 'dark', 'blue', 'green', 'purple')
    """

    def __init__(
        self,
        fn: Callable,
        inputs: Union[str, Any, List[Union[str, Any]]] = None,
        outputs: Union[str, Any, List[Union[str, Any]]] = None,
        title: str = "ChaiLab Demo",
        description: str = "",
        theme: str = "default",
        **kwargs
    ):
        self.fn = fn
        self.inputs = inputs or []
        self.outputs = outputs or []
        self.title = title
        self.description = description
        self.theme = theme
        self.app = None

        if not isinstance(self.inputs, list):
            self.inputs = [self.inputs]
        if not isinstance(self.outputs, list):
            self.outputs = [self.outputs]

    def _create_app(self):
        """Create FastAPI application"""
        app = FastAPI(title=self.title, description=self.description)

        # Add CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.get("/", response_class=HTMLResponse)
        async def root():
            return self._get_html()

        @app.post("/api/predict")
        async def predict(request: Request):
            data = await request.json()
            inputs = data.get("inputs", [])

            try:
                if len(inputs) == 1:
                    result = self.fn(inputs[0])
                else:
                    result = self.fn(*inputs)

                if not isinstance(result, (list, tuple)):
                    result = [result]

                return {"outputs": result, "success": True}
            except Exception as e:
                return {"error": str(e), "success": False}

        return app

    def _get_html(self):
        """Generate HTML for the interface"""
        # Create component configurations
        input_configs = []
        for i, inp in enumerate(self.inputs):
            if isinstance(inp, str):
                # Handle string components
                _normalized = inp.lower()
                _mapped = "input" if _normalized in ["text", "textbox", "input"] else _normalized
                config = {
                    "id": f"input_{i}",
                    "type": _mapped,
                    "props": {},
                    "label": f"Input {i+1}"
                }
            else:
                # Handle shadcn/ui components
                config = {
                    "id": f"input_{i}",
                    "type": inp.__class__.__name__.lower(),
                    "props": inp.get_props() if hasattr(inp, 'get_props') else {},
                    "label": inp.props.get('label', f'Input {i+1}') if hasattr(inp, 'props') else f'Input {i+1}'
                }
            input_configs.append(config)

        output_configs = []
        for i, out in enumerate(self.outputs):
            if isinstance(out, str):
                _normalized = out.lower()
                _mapped = "text" if _normalized in ["text", "textbox", "output", "label"] else _normalized
                config = {
                    "id": f"output_{i}",
                    "type": _mapped,
                    "props": {},
                    "label": f"Output {i+1}"
                }
            else:
                config = {
                    "id": f"output_{i}",
                    "type": out.__class__.__name__.lower(),
                    "props": out.get_props() if hasattr(out, 'get_props') else {},
                    "label": out.props.get('label', f'Output {i+1}') if hasattr(out, 'props') else f'Output {i+1}'
                }
            output_configs.append(config)

        # Generate HTML with shadcn/ui styling
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{self.title}</title>
            <script src="https://cdn.tailwindcss.com"></script>
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
            <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
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

                .dark {{
                    --background: 222.2 84% 4.9%;
                    --foreground: 210 40% 98%;
                    --card: 222.2 84% 4.9%;
                    --card-foreground: 210 40% 98%;
                    --popover: 222.2 84% 4.9%;
                    --popover-foreground: 210 40% 98%;
                    --primary: 210 40% 98%;
                    --primary-foreground: 222.2 47.4% 11.2%;
                    --secondary: 217.2 32.6% 17.5%;
                    --secondary-foreground: 210 40% 98%;
                    --muted: 217.2 32.6% 17.5%;
                    --muted-foreground: 215 20.2% 65.1%;
                    --accent: 217.2 32.6% 17.5%;
                    --accent-foreground: 210 40% 98%;
                    --destructive: 0 62.8% 30.6%;
                    --destructive-foreground: 210 40% 98%;
                    --border: 217.2 32.6% 17.5%;
                    --input: 217.2 32.6% 17.5%;
                    --ring: 212.7 26.8% 83.9%;
                }}

                @layer base {{
                    * {{
                        @apply border-border;
                    }}
                    body {{
                        @apply bg-background text-foreground;
                    }}
                }}
            </style>
        </head>
        <body class="min-h-screen bg-background p-4">
            <div class="container max-w-4xl mx-auto">
                <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-6">
                    <div class="space-y-2">
                        <h1 class="text-2xl font-semibold">{self.title}</h1>
                        {f'<p class="text-muted-foreground">{self.description}</p>' if self.description else ''}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-4">
                            <h3 class="text-lg font-medium">Inputs</h3>
                            <div id="inputs" class="space-y-4"></div>
                        </div>
                        <div class="space-y-4">
                            <h3 class="text-lg font-medium">Outputs</h3>
                            <div id="outputs" class="space-y-4"></div>
                        </div>
                    </div>

                    <div class="flex justify-end">
                        <button id="submit-btn" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                            Submit
                        </button>
                    </div>
                </div>
            </div>

            <script type="text/babel">
                const componentConfigs = {json.dumps({
                    "inputs": input_configs,
                    "outputs": output_configs
                })};

                function InputComponent({{ config }}) {{
                    if (config.type === 'input') {{
                        return (
                            <div className="space-y-2">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {{config.props.label || config.label}}
                                </label>
                                <input
                                    type={{config.props.type || 'text'}}
                                    placeholder={{config.props.placeholder || ''}}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    onChange={{(e) => window.inputValues = {{...window.inputValues, [config.id]: e.target.value}}}}
                                />
                            </div>
                        );
                    }}

                    // Default text input for other types
                    return (
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {{config.label}}
                            </label>
                            <input
                                type="text"
                                placeholder="Enter text..."
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                onChange={{(e) => window.inputValues = {{...window.inputValues, [config.id]: e.target.value}}}}
                            />
                        </div>
                    );
                }}

                function SliderComponent({{ config }}) {{
                    const defaultValue = config.props && config.props.value ? config.props.value : 50;
                    const [value, setValue] = React.useState(defaultValue);

                    React.useEffect(() => {{
                        if (!window.inputValues) window.inputValues = {{}};
                        window.inputValues[config.id] = value;
                    }}, [value, config.id]);

                    return (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {{config.label}}
                                </label>
                                <span className="text-sm text-muted-foreground">{{value}}</span>
                            </div>
                            <input
                                type="range"
                                min={{config.props && config.props.min ? config.props.min : 0}}
                                max={{config.props && config.props.max ? config.props.max : 100}}
                                step={{config.props && config.props.step ? config.props.step : 1}}
                                value={{value}}
                                onChange={{(e) => setValue(parseFloat(e.target.value))}}
                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    );
                }}

                function OutputComponent({{ config, value }}) {{
                    return (
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {{config.label}}
                            </label>
                            <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background">
                                {{value || 'Output will appear here'}}
                            </div>
                        </div>
                    );
                }}

                function App() {{
                    const [outputs, setOutputs] = React.useState([]);

                    const handleSubmit = async () => {{
                        const inputs = componentConfigs.inputs.map(config => {{
                            return window.inputValues?.[config.id] || '';
                        }});

                        try {{
                            const response = await fetch('/api/predict', {{
                                method: 'POST',
                                headers: {{
                                    'Content-Type': 'application/json',
                                }},
                                body: JSON.stringify({{ inputs }}),
                            }});

                            const result = await response.json();
                            if (result.success) {{
                                setOutputs(result.outputs);
                            }} else {{
                                console.error('Error:', result.error);
                            }}
                        }} catch (error) {{
                            console.error('Error:', error);
                        }}
                    }};

                    React.useEffect(() => {{
                        document.getElementById('submit-btn').addEventListener('click', handleSubmit);
                        return () => {{
                            document.getElementById('submit-btn')?.removeEventListener('click', handleSubmit);
                        }};
                    }}, []);

                    return (
                        <div>
                            <div id="inputs">
                                {{componentConfigs.inputs.map(config => {{
                                    if (config.type === 'slider') {{
                                        return <SliderComponent key={{config.id}} config={{config}} />;
                                    }} else {{
                                        return <InputComponent key={{config.id}} config={{config}} />;
                                    }}
                                }}) }}
                            </div>
                            <div id="outputs">
                                {{componentConfigs.outputs.map((config, index) => (
                                    <OutputComponent
                                        key={{config.id}}
                                        config={{config}}
                                        value={{outputs[index]}}
                                    />
                                ))}}
                            </div>
                        </div>
                    );
                }}

                const root = ReactDOM.createRoot(document.getElementById('inputs').parentNode.parentNode);
                root.render(<App />);
            </script>
        </body>
        </html>
        """
        return html

    def launch(self, host: str = "127.0.0.1", port: int = 7860, share: bool = False, **kwargs):
        """
        Launch the ChaiLab interface

        Args:
            host: Host to run the server on
            port: Port to run the server on
            share: Whether to create a public URL (not implemented yet)
        """
        self.app = self._create_app()

        print(f"Starting ChaiLab server at http://{host}:{port}")
        print(f"{self.title}")
        if self.description:
            print(f"{self.description}")

        if share:
            print("Share functionality not implemented yet")

        print("\nPress Ctrl+C to stop the server")

        # Run the server
        uvicorn.run(self.app, host=host, port=port, log_level="info")

    def integrate(self, wandb=None, **kwargs):
        """
        Integrate with other libraries (similar to Gradio's integrate method)

        Args:
            wandb: W&B instance for experiment tracking
        """
        if wandb is not None:
            print("✅ W&B integration ready")
            # Could add W&B logging functionality here
        return self