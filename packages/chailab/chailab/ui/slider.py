"""
ChaiLab Slider Component - Based on shadcn/ui Slider
"""

from typing import Optional, List, Union
from . import Component


class Slider(Component):
    """
    Slider component following shadcn/ui design system

    Args:
        value: Default value(s) for the slider
        min: Minimum value
        max: Maximum value
        step: Step increment
        label: Label text for the slider
        show_value: Whether to show the current value
        disabled: Whether the slider is disabled
        orientation: 'horizontal' or 'vertical'
    """

    component_type = "slider"
    aliases = ("slider",)
    default_label = "Slider"

    def __init__(
        self,
        value: Union[List[float], float] = 50,
        min: float = 0,
        max: float = 100,
        step: float = 1,
        label: Optional[str] = None,
        show_value: bool = True,
        disabled: bool = False,
        orientation: str = "horizontal",
        **kwargs
    ):
        # Ensure value is a list
        if isinstance(value, (int, float)):
            value = [value]

        super().__init__(
            value=value,
            min=min,
            max=max,
            step=step,
            label=label,
            show_value=show_value,
            disabled=disabled,
            orientation=orientation,
            **kwargs
        )

    def get_props(self):
        return {
            "value": self.props.get("value", [50]),
            "min": self.props.get("min", 0),
            "max": self.props.get("max", 100),
            "step": self.props.get("step", 1),
            "label": self.props.get("label"),
            "show_value": self.props.get("show_value", True),
            "disabled": self.props.get("disabled", False),
            "orientation": self.props.get("orientation", "horizontal"),
        }

    def get_base_classes(self):
        """Get base Tailwind classes for the slider"""
        return "relative flex w-full touch-none select-none items-center"

    def get_track_classes(self):
        """Get track classes"""
        return "relative h-2 w-full grow overflow-hidden rounded-full bg-secondary"

    def get_range_classes(self):
        """Get range classes"""
        return "absolute h-full bg-primary"

    def get_thumb_classes(self):
        """Get thumb classes"""
        return "block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"

    def get_full_classes(self):
        """Get all Tailwind classes combined"""
        return self.get_base_classes()
