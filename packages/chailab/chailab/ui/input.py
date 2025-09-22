"""
ChaiLab Input Component - Based on shadcn/ui Input
"""

from typing import Optional
from . import Component


class Input(Component):
    """
    Input component following shadcn/ui design system

    Args:
        value: Default value
        placeholder: Placeholder text
        type: Input type ('text', 'email', 'password', 'number', etc.)
        disabled: Whether the input is disabled
        label: Label text for the input
        error: Error message to display
        required: Whether the input is required
    """

    component_type = "input"
    aliases = ("input", "textbox", "text")
    default_label = "Input"

    def __init__(
        self,
        value: str = "",
        placeholder: str = "",
        type: str = "text",
        disabled: bool = False,
        label: Optional[str] = None,
        error: Optional[str] = None,
        required: bool = False,
        **kwargs
    ):
        super().__init__(
            value=value,
            placeholder=placeholder,
            type=type,
            disabled=disabled,
            label=label,
            error=error,
            required=required,
            **kwargs
        )

    def get_props(self):
        return {
            "value": self.props.get("value", ""),
            "placeholder": self.props.get("placeholder", ""),
            "type": self.props.get("type", "text"),
            "disabled": self.props.get("disabled", False),
            "label": self.props.get("label"),
            "error": self.props.get("error"),
            "required": self.props.get("required", False),
        }

    def get_base_classes(self):
        """Get base Tailwind classes for the input"""
        return "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"

    def get_error_classes(self):
        """Get error state classes"""
        if self.props.get("error"):
            return "border-destructive focus-visible:ring-destructive"
        return ""

    def get_full_classes(self):
        """Get all Tailwind classes combined"""
        base = self.get_base_classes()
        error = self.get_error_classes()
        return f"{base} {error}".strip()
