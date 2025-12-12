"""ChaiLab Text display component."""

from __future__ import annotations

from typing import Optional

from . import Component


class Text(Component):
    component_type = "text"
    aliases = ("text", "textbox", "output")
    default_label = "Output"

    def __init__(self, value: Optional[str] = None, placeholder: str = "", **kwargs):
        super().__init__(value=value, placeholder=placeholder, **kwargs)

    def get_props(self):
        return {
            "value": self.props.get("value"),
            "placeholder": self.props.get("placeholder", ""),
            "label": self.props.get("label", self.default_label),
        }
