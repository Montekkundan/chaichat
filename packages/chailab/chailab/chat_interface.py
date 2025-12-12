"""High-level chat wrapper similar to ``gradio.ChatInterface``."""

from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any, Callable, Dict, List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from .blocks import Blocks


class ChatInterface(Blocks):
    def __init__(
        self,
        fn: Callable[[str, List[Dict[str, Any]]], Any],
        *,
        title: str = "ChaiLab Chat",
        description: str | None = None,
        theme: str = "default",
        placeholder: str = "Send a message…",
        autofocus: bool = True,
        save_history: bool = False,
    ) -> None:
        super().__init__(title=title, description=description or "", theme=theme)
        self.fn = fn
        self.placeholder = placeholder
        self.autofocus = autofocus
        self.save_history = save_history

    # ------------------------------------------------------------------
    # FastAPI application
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

        @app.post("/api/chat")
        async def chat(request: Request):
            payload = await request.json()
            message = payload.get("message", "")
            history = payload.get("history", [])
            if not isinstance(history, list):
                return JSONResponse({"success": False, "error": "History must be a list."}, status_code=400)

            try:
                response, updated_history = await self._execute(message, history)
            except Exception as exc:  # pragma: no cover
                return JSONResponse({"success": False, "error": str(exc)}, status_code=500)

            return {
                "success": True,
                "message": response,
                "history": updated_history,
            }

        return app

    async def _execute(self, message: str, history: List[Dict[str, Any]]):
        fn = self.fn
        history_copy = [dict(item) for item in history]

        if inspect.iscoroutinefunction(fn):
            result = await fn(message, history_copy)
        else:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                result = await loop.run_in_executor(None, lambda: fn(message, history_copy))
            else:
                result = fn(message, history_copy)

        if inspect.isasyncgen(result):
            chunks: List[str] = [chunk async for chunk in result]
            response_text = "".join(map(str, chunks))
        elif inspect.isgenerator(result):
            chunks = list(result)
            response_text = "".join(map(str, chunks))
        else:
            response_text = str(result) if result is not None else ""

        updated_history = history_copy + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": response_text},
        ]

        return response_text, updated_history

    # ------------------------------------------------------------------
    # Rendering helpers
    # ------------------------------------------------------------------
    def _render_html(self) -> str:
        config = {
            "title": self.title,
            "description": self.description,
            "placeholder": self.placeholder,
            "autofocus": self.autofocus,
            "save_history": self.save_history,
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
            <div id=\"app\" class=\"container mx-auto max-w-3xl px-4\"></div>
            <script type=\"text/babel\">
                const chatConfig = {config_json};

                const HISTORY_KEY = 'chailab_chat_history';

                function loadHistory() {{
                    if (!chatConfig.save_history) return [];
                    try {{
                        const raw = window.localStorage.getItem(HISTORY_KEY);
                        if (!raw) return [];
                        const parsed = JSON.parse(raw);
                        return Array.isArray(parsed) ? parsed : [];
                    }} catch (err) {{
                        console.warn('Failed to load chat history:', err);
                        return [];
                    }}
                }}

                function persistHistory(history) {{
                    if (!chatConfig.save_history) return;
                    try {{
                        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
                    }} catch (err) {{
                        console.warn('Failed to persist chat history:', err);
                    }}
                }}

                function ChatMessage({{ entry }}) {{
                    const isUser = entry.role === 'user';
                    const alignment = isUser ? 'justify-end' : 'justify-start';
                    const bubble = isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground';
                    return (
                        <div className={{"flex " + alignment}}>
                            <div className={{"max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm " + bubble}}>
                                {{entry.content}}
                            </div>
                        </div>
                    );
                }}

                function App() {{
                    const [history, setHistory] = React.useState(() => loadHistory());
                    const [message, setMessage] = React.useState('');
                    const [isLoading, setIsLoading] = React.useState(false);
                    const [error, setError] = React.useState(null);
                    const containerRef = React.useRef(null);

                    React.useEffect(() => {{
                        if (!containerRef.current) return;
                        containerRef.current.scrollTop = containerRef.current.scrollHeight;
                    }}, [history, isLoading]);

                    const sendMessage = async () => {{
                        if (!message.trim()) return;
                        const nextHistory = [...history, {{ role: 'user', content: message }}];
                        setHistory(nextHistory);
                        persistHistory(nextHistory);
                        setMessage('');
                        setIsLoading(true);
                        setError(null);

                        try {{
                            const response = await fetch('/api/chat', {{
                                method: 'POST',
                                headers: {{ 'Content-Type': 'application/json' }},
                                body: JSON.stringify({{
                                    message,
                                    history,
                                }}),
                            }});
                            const data = await response.json();
                            if (data.success) {{
                                setHistory(data.history);
                                persistHistory(data.history);
                            }} else {{
                                setError(data.error || 'Unknown error');
                            }}
                        }} catch (err) {{
                            setError(err.message);
                        }} finally {{
                            setIsLoading(false);
                        }}
                    }};

                    const handleSubmit = (event) => {{
                        event.preventDefault();
                        sendMessage();
                    }};

                    const handleClear = () => {{
                        setHistory([]);
                        persistHistory([]);
                    }};

                    return (
                        <div className=\"space-y-4\">
                            <div className=\"rounded-lg border bg-card text-card-foreground shadow-sm\">
                                <div className=\"border-b px-6 py-4\">
                                    <div className=\"flex items-start justify-between\">
                                        <div>
                                            <h1 className=\"text-2xl font-semibold\">{{chatConfig.title}}</h1>
                                            {{chatConfig.description ? (
                                                <p className=\"text-sm text-muted-foreground\">{{chatConfig.description}}</p>
                                            ) : null}}
                                        </div>
                                        <button
                                            type=\"button\"
                                            onClick={{handleClear}}
                                            className=\"text-sm text-muted-foreground hover:text-foreground\"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                <div ref={{containerRef}} className=\"flex h-[420px] flex-col gap-3 overflow-y-auto bg-muted/40 px-6 py-4\">
                                    {{history.length === 0 && !isLoading ? (
                                        <div className=\"flex h-full items-center justify-center text-sm text-muted-foreground\">
                                            Start the conversation by sending a message.
                                        </div>
                                    ) : (
                                        history.map((entry, index) => <ChatMessage key={{index}} entry={{entry}} />)
                                    )}}
                                    {{isLoading ? (
                                        <div className=\"flex justify-start\">
                                            <div className=\"flex items-center gap-1 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground\">
                                                <span className=\"size-2 animate-bounce rounded-full bg-secondary-foreground\"></span>
                                                <span className=\"size-2 animate-bounce rounded-full bg-secondary-foreground [animation-delay:150ms]\"></span>
                                                <span className=\"size-2 animate-bounce rounded-full bg-secondary-foreground [animation-delay:300ms]\"></span>
                                            </div>
                                        </div>
                                    ) : null}}
                                </div>
                                <form onSubmit={{handleSubmit}} className=\"border-t bg-card px-6 py-4\">
                                    <div className=\"flex items-center gap-2\">
                                        <textarea
                                            value={{message}}
                                            onChange={{(event) => setMessage(event.target.value)}}
                                            placeholder={{chatConfig.placeholder}}
                                            autoFocus={{chatConfig.autofocus}}
                                            rows={{1}}
                                            className=\"flex-grow resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2\"
                                        />
                                        <button
                                            type=\"submit\"
                                            disabled={{isLoading || !message.trim()}}
                                            className=\"inline-flex items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50\"
                                        >
                                            Send
                                        </button>
                                    </div>
                                    {{error ? (
                                        <p className=\"mt-2 text-sm text-destructive\">{{error}}</p>
                                    ) : null}}
                                </form>
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


__all__ = ["ChatInterface"]
