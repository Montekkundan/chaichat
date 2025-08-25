"""
ChaiLab UI Components - Based on shadcn/ui design system
"""

from abc import ABC, abstractmethod
from typing import Any, Dict


class Component(ABC):
    """Base class for all ChaiLab UI components"""

    def __init__(self, **props):
        self.props = props

    @abstractmethod
    def get_props(self) -> Dict[str, Any]:
        """Get the component properties for rendering"""
        pass

    def __repr__(self):
        return f"{self.__class__.__name__}({self.props})"


from .button import Button
from .input import Input
from .label import Label
from .card import Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
from .slider import Slider

__all__ = [
    "Component",
    "Button",
    "Input",
    "Label",
    "Card",
    "CardHeader",
    "CardTitle",
    "CardDescription",
    "CardContent",
    "CardFooter",
    "Slider",
]
