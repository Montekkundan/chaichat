"""
ChaiLab Label Component - Based on shadcn/ui Label
"""

from typing import Optional
from . import Component


class Label(Component):
    """
    Label component following shadcn/ui design system

    Args:
        text: Label text content
        html_for: ID of the associated form element
        disabled: Whether the label is disabled
        required: Whether the associated field is required
    """

    def __init__(
        self,
        text: str = "",
        html_for: Optional[str] = None,
        disabled: bool = False,
        required: bool = False,
        **kwargs
    ):
        super().__init__(
            text=text,
            html_for=html_for,
            disabled=disabled,
            required=required,
            **kwargs
        )

    def get_props(self):
        return {
            "text": self.props.get("text", ""),
            "html_for": self.props.get("html_for"),
            "disabled": self.props.get("disabled", False),
            "required": self.props.get("required", False),
        }

    def get_base_classes(self):
        """Get base Tailwind classes for the label"""
        return "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"

    def get_required_indicator(self):
        """Get the required indicator if needed"""
        if self.props.get("required"):
            return ' <span class="text-destructive">*</span>'
        return ""

    def get_full_classes(self):
        """Get all Tailwind classes combined"""
        return self.get_base_classes()
