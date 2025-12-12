"""
ChaiLab Card Component - Based on shadcn/ui Card
"""

from typing import Optional
from . import Component


class Card(Component):
    """
    Card component following shadcn/ui design system

    Args:
        title: Card title
        description: Card description
        content: Card content
        footer: Card footer content
        class_name: Additional CSS classes
    """

    component_type = "card"
    aliases = ("card",)
    default_label = "Card"

    def __init__(
        self,
        title: Optional[str] = None,
        description: Optional[str] = None,
        content: Optional[str] = None,
        footer: Optional[str] = None,
        class_name: str = "",
        **kwargs
    ):
        super().__init__(
            title=title,
            description=description,
            content=content,
            footer=footer,
            class_name=class_name,
            **kwargs
        )

    def get_props(self):
        return {
            "title": self.props.get("title"),
            "description": self.props.get("description"),
            "content": self.props.get("content"),
            "footer": self.props.get("footer"),
            "class_name": self.props.get("class_name", ""),
            "label": self.props.get("label", self.default_label),
        }

    def get_base_classes(self):
        """Get base Tailwind classes for the card"""
        return "rounded-lg border bg-card text-card-foreground shadow-sm"

    def get_full_classes(self):
        """Get all Tailwind classes combined"""
        base = self.get_base_classes()
        custom = self.props.get("class_name", "")
        return f"{base} {custom}".strip()


class CardHeader(Component):
    """Card header component"""

    component_type = "card-header"
    aliases = ("cardheader", "card-header")
    default_label = "Card Header"

    def __init__(self, class_name: str = "", **kwargs):
        super().__init__(class_name=class_name, **kwargs)

    def get_props(self):
        return {
            "class_name": self.props.get("class_name", ""),
            "label": self.props.get("label", self.default_label),
        }

    def get_base_classes(self):
        return "flex flex-col space-y-1.5 p-6"

    def get_full_classes(self):
        base = self.get_base_classes()
        custom = self.props.get("class_name", "")
        return f"{base} {custom}".strip()


class CardTitle(Component):
    """Card title component"""

    component_type = "card-title"
    aliases = ("cardtitle", "card-title")
    default_label = "Card Title"

    def __init__(self, text: str = "", class_name: str = "", **kwargs):
        super().__init__(text=text, class_name=class_name, **kwargs)

    def get_props(self):
        return {
            "text": self.props.get("text", ""),
            "class_name": self.props.get("class_name", ""),
            "label": self.props.get("label", self.default_label),
        }

    def get_base_classes(self):
        return "text-2xl font-semibold leading-none tracking-tight"

    def get_full_classes(self):
        base = self.get_base_classes()
        custom = self.props.get("class_name", "")
        return f"{base} {custom}".strip()


class CardDescription(Component):
    """Card description component"""

    component_type = "card-description"
    aliases = ("carddescription", "card-description")
    default_label = "Card Description"

    def __init__(self, text: str = "", class_name: str = "", **kwargs):
        super().__init__(text=text, class_name=class_name, **kwargs)

    def get_props(self):
        return {
            "text": self.props.get("text", ""),
            "class_name": self.props.get("class_name", ""),
            "label": self.props.get("label", self.default_label),
        }

    def get_base_classes(self):
        return "text-sm text-muted-foreground"

    def get_full_classes(self):
        base = self.get_base_classes()
        custom = self.props.get("class_name", "")
        return f"{base} {custom}".strip()


class CardContent(Component):
    """Card content component"""

    component_type = "card-content"
    aliases = ("cardcontent", "card-content")
    default_label = "Card Content"

    def __init__(self, class_name: str = "", **kwargs):
        super().__init__(class_name=class_name, **kwargs)

    def get_props(self):
        return {
            "class_name": self.props.get("class_name", ""),
            "label": self.props.get("label", self.default_label),
        }

    def get_base_classes(self):
        return "p-6 pt-0"

    def get_full_classes(self):
        base = self.get_base_classes()
        custom = self.props.get("class_name", "")
        return f"{base} {custom}".strip()


class CardFooter(Component):
    """Card footer component"""

    component_type = "card-footer"
    aliases = ("cardfooter", "card-footer")
    default_label = "Card Footer"

    def __init__(self, class_name: str = "", **kwargs):
        super().__init__(class_name=class_name, **kwargs)

    def get_props(self):
        return {
            "class_name": self.props.get("class_name", ""),
            "label": self.props.get("label", self.default_label),
        }

    def get_base_classes(self):
        return "flex items-center p-6 pt-0"

    def get_full_classes(self):
        base = self.get_base_classes()
        custom = self.props.get("class_name", "")
        return f"{base} {custom}".strip()
