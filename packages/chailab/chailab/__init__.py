"""
ChaiLab - A Gradio-like interface using shadcn/ui components
"""

from .interface import Interface
from . import ui
from . import themes
from ._version import __version__
__all__ = [
    "Interface",
    "ui",
    "themes"
]