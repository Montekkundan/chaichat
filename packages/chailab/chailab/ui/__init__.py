"""ChaiLab UI component base classes and registry."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional, Tuple, Type, Union


class Component(ABC):
    """Base class for all ChaiLab UI components.

    Sub-classes should override :meth:`get_props` to expose the data required by the
    front-end renderer. Components can optionally customise their ``component_type``
    and ``aliases`` which are used by the registry for string-based lookup (e.g.
    ``"textbox"`` → ``Input``).
    """

    component_type: str = "component"
    aliases: Tuple[str, ...] = ()
    default_label: Optional[str] = None

    def __init__(self, **props: Any):
        self.props = props

    @abstractmethod
    def get_props(self) -> Dict[str, Any]:
        """Return the serialisable props for the renderer."""

    def to_config(self, component_id: str, label: Optional[str] = None) -> Dict[str, Any]:
        """Build the configuration payload consumed by the front-end."""

        resolved_label = (
            label
            or self.props.get("label")
            or self.default_label
            or component_id.replace("_", " ").title()
        )
        return {
            "id": component_id,
            "type": self.component_type,
            "props": self.get_props(),
            "label": resolved_label,
        }

    def __repr__(self) -> str:  # pragma: no cover - convenience only
        return f"{self.__class__.__name__}({self.props})"


@dataclass(frozen=True)
class _ComponentEntry:
    component_type: str
    cls: Type[Component]
    aliases: Tuple[str, ...]


class ComponentRegistry:
    """Registry used to resolve components by alias or component type."""

    def __init__(self) -> None:
        self._by_type: Dict[str, _ComponentEntry] = {}
        self._by_alias: Dict[str, _ComponentEntry] = {}

    def register(
        self,
        component_cls: Type[Component],
        *,
        component_type: Optional[str] = None,
        aliases: Optional[Iterable[str]] = None,
    ) -> None:
        component_type = (
            component_type
            or getattr(component_cls, "component_type", component_cls.__name__.lower())
        )
        alias_tuple: Tuple[str, ...] = tuple(
            dict.fromkeys(
                [component_type]
                + [component_cls.__name__.lower()]
                + list(component_cls.aliases)
                + list(aliases or [])
            )
        )

        entry = _ComponentEntry(component_type=component_type, cls=component_cls, aliases=alias_tuple)
        self._by_type[component_type] = entry
        for alias in alias_tuple:
            self._by_alias[alias] = entry

    def resolve(self, key: Union[str, Type[Component]]) -> Type[Component]:
        if isinstance(key, str):
            lowered = key.lower()
            if lowered not in self._by_alias:
                raise KeyError(f"Unknown component alias '{key}'")
            return self._by_alias[lowered].cls
        if issubclass(key, Component):
            return key
        raise TypeError(f"Cannot resolve component from {key!r}")

    def registered_types(self) -> Tuple[str, ...]:
        return tuple(self._by_type.keys())


component_registry = ComponentRegistry()


def register_component(
    component_cls: Type[Component],
    *,
    aliases: Optional[Iterable[str]] = None,
    component_type: Optional[str] = None,
) -> Type[Component]:
    """Convenience decorator/helper to register a component class."""

    component_registry.register(
        component_cls,
        component_type=component_type,
        aliases=aliases,
    )
    return component_cls


from .button import Button
from .input import Input
from .label import Label
from .card import Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
from .slider import Slider
from .text import Text

register_component(Button, aliases=("button",))
register_component(Input, aliases=("text", "textbox", "input"))
register_component(Label, aliases=("label",))
register_component(Card, aliases=("card",))
register_component(CardHeader, aliases=("cardheader", "card-header"))
register_component(CardTitle, aliases=("cardtitle", "card-title"))
register_component(CardDescription, aliases=("carddescription", "card-description"))
register_component(CardContent, aliases=("cardcontent", "card-content"))
register_component(CardFooter, aliases=("cardfooter", "card-footer"))
register_component(Slider, aliases=("slider",))
register_component(Text, aliases=("text", "textbox", "output"))

__all__ = [
    "Component",
    "ComponentRegistry",
    "component_registry",
    "register_component",
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
    "Text",
]
