"""Core runtime utilities for ChaiLab high-level interfaces."""

from __future__ import annotations

import contextlib
import socket
import threading
import time
import webbrowser
from dataclasses import dataclass
from typing import Optional

import uvicorn


def _is_notebook_environment() -> bool:
    """Return True when running inside a Jupyter/Colab notebook."""

    try:  # pragma: no cover - defensive detection only
        from IPython import get_ipython  # type: ignore
    except ImportError:  # pragma: no cover - IPython unavailable
        return False

    ip = get_ipython()
    if ip is None:
        return False

    shell_name = ip.__class__.__name__
    return shell_name in {"ZMQInteractiveShell", "Shell"}


@dataclass
class _ServerHandle:
    server: uvicorn.Server
    thread: threading.Thread


class Blocks:
    """Minimal runtime that manages the FastAPI app lifecycle."""

    def __init__(self, *, title: str | None = None, description: str | None = None, theme: str = "default") -> None:
        self.title = title or "ChaiLab"
        self.description = description or ""
        self.theme = theme
        self.app = None
        self._server_handle: Optional[_ServerHandle] = None
        self._last_launch_url: Optional[str] = None

    # ---------------------------------------------------------------------
    # Lifecycle helpers
    # ---------------------------------------------------------------------
    def _create_app(self):  # pragma: no cover - implemented by subclasses
        raise NotImplementedError

    def _ensure_app(self):
        if self.app is None:
            self.app = self._create_app()
        return self.app

    def launch(
        self,
        host: str = "127.0.0.1",
        port: int = 7860,
        *,
        inline: bool | None = None,
        open_browser: bool | None = None,
        block: bool | None = None,
        log_level: str = "info",
        share: bool = False,
    ) -> "Blocks":
        """Launch the FastAPI application.

        Args:
            host: Host to bind to.
            port: Port to bind to.
            inline: Force inline (notebook) rendering.
            open_browser: Whether to open a browser tab (ignored when inline).
            block: Whether to block the current thread. Defaults to ``True`` when
                not running in a notebook.
            log_level: Uvicorn log level.
            share: Placeholder argument for future public sharing support.
        """

        if share:  # pragma: no cover - share UX not yet implemented
            print("Share functionality is not implemented yet.")

        inline = _is_notebook_environment() if inline is None else inline
        block = (not inline) if block is None else block
        open_browser = (not inline) if open_browser is None else open_browser

        app = self._ensure_app()
        url = f"http://{host}:{port}"
        self._last_launch_url = url

        if block:
            print(f"Starting ChaiLab server at {url}")
            if self.description:
                print(self.description)
            uvicorn.run(app, host=host, port=port, log_level=log_level)
            return self

        config = uvicorn.Config(app, host=host, port=port, log_level=log_level)
        server = uvicorn.Server(config)

        thread = threading.Thread(target=server.run, name="ChaiLabServer", daemon=True)
        thread.start()
        self._wait_for_server(host, port)
        self._server_handle = _ServerHandle(server=server, thread=thread)

        if inline:
            self._display_inline(url)
        elif open_browser:
            with contextlib.suppress(Exception):  # pragma: no cover - best effort
                webbrowser.open(url)
        else:
            print(f"ChaiLab running at {url}")

        return self

    def close(self, timeout: float = 2.0) -> None:
        """Shut down the running server if it was launched in non-blocking mode."""

        if not self._server_handle:
            return

        self._server_handle.server.should_exit = True
        self._server_handle.thread.join(timeout=timeout)
        self._server_handle = None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _wait_for_server(host: str, port: int, timeout: float = 10.0) -> None:
        """Poll until the server socket accepts connections."""

        deadline = time.time() + timeout
        while time.time() < deadline:
            with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
                sock.settimeout(0.2)
                try:
                    sock.connect((host, port))
                except OSError:
                    time.sleep(0.1)
                    continue
                return
        raise RuntimeError("ChaiLab server failed to start in time.")

    @staticmethod
    def _display_inline(url: str) -> None:
        try:  # pragma: no cover - optional dependency
            from IPython.display import IFrame, display  # type: ignore
        except Exception:  # pragma: no cover
            print(f"ChaiLab running at {url} (inline display unavailable)")
            return

        display(IFrame(src=url, width="100%", height="600px"))

    # ------------------------------------------------------------------
    # Context manager support
    # ------------------------------------------------------------------
    def __enter__(self) -> "Blocks":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()


__all__ = ["Blocks"]
