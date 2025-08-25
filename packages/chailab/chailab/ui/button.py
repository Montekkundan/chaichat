"""
ChaiLab Button Component - Based on shadcn/ui Button
"""

from typing import Optional
from . import Component


class Button(Component):
    """
    Button component following shadcn/ui design system

    Args:
        value: Button text content
        variant: Button style variant ('default', 'destructive', 'outline', 'secondary', 'ghost', 'link')
        size: Button size ('default', 'sm', 'lg', 'icon')
        disabled: Whether the button is disabled
        on_click: JavaScript function to call on click (for future enhancement)
    """

    def __init__(
        self,
        value: str = "Button",
        variant: str = "default",
        size: str = "default",
        disabled: bool = False,
        on_click: Optional[str] = None,
        **kwargs
    ):
        super().__init__(
            value=value,
            variant=variant,
            size=size,
            disabled=disabled,
            on_click=on_click,
            **kwargs
        )

    def get_props(self):
        return {
            "value": self.props.get("value", "Button"),
            "variant": self.props.get("variant", "default"),
            "size": self.props.get("size", "default"),
            "disabled": self.props.get("disabled", False),
            "on_click": self.props.get("on_click"),
        }

    def get_variant_classes(self):
        """Get Tailwind classes for the button variant"""
        variants = {
            "default": "bg-primary text-primary-foreground hover:bg-primary/90",
            "destructive": "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            "outline": "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            "secondary": "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            "ghost": "hover:bg-accent hover:text-accent-foreground",
            "link": "text-primary underline-offset-4 hover:underline",
        }
        return variants.get(self.props.get("variant", "default"), variants["default"])

    def get_size_classes(self):
        """Get Tailwind classes for the button size"""
        sizes = {
            "default": "h-10 px-4 py-2",
            "sm": "h-9 rounded-md px-3",
            "lg": "h-11 rounded-md px-8",
            "icon": "h-10 w-10",
        }
        return sizes.get(self.props.get("size", "default"), sizes["default"])

    def get_base_classes(self):
        """Get base Tailwind classes for the button"""
        return "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

    def get_full_classes(self):
        """Get all Tailwind classes combined"""
        base = self.get_base_classes()
        variant = self.get_variant_classes()
        size = self.get_size_classes()
        return f"{base} {variant} {size}"
