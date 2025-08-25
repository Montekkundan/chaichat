"""
ChaiLab Theme Configuration - Based on shadcn/ui theming system
"""

from typing import Dict, Any


class Theme:
    """Theme configuration class"""

    def __init__(self, name: str, colors: Dict[str, str]):
        self.name = name
        self.colors = colors

    def get_css_variables(self) -> str:
        """Generate CSS custom properties for the theme"""
        css_vars = []
        for key, value in self.colors.items():
            css_vars.append(f"  --{key}: {value};")
        return "\n".join(css_vars)


# Default (Light) Theme - Based on shadcn/ui default
DEFAULT_THEME = Theme("default", {
    "background": "0 0% 100%",
    "foreground": "222.2 84% 4.9%",
    "card": "0 0% 100%",
    "card-foreground": "222.2 84% 4.9%",
    "popover": "0 0% 100%",
    "popover-foreground": "222.2 84% 4.9%",
    "primary": "222.2 47.4% 11.2%",
    "primary-foreground": "210 40% 98%",
    "secondary": "210 40% 96%",
    "secondary-foreground": "222.2 47.4% 11.2%",
    "muted": "210 40% 96%",
    "muted-foreground": "215.4 16.3% 46.9%",
    "accent": "210 40% 96%",
    "accent-foreground": "222.2 47.4% 11.2%",
    "destructive": "0 84.2% 60.2%",
    "destructive-foreground": "210 40% 98%",
    "border": "214.3 31.8% 91.4%",
    "input": "214.3 31.8% 91.4%",
    "ring": "222.2 84% 4.9%",
    "chart-1": "12 76% 61%",
    "chart-2": "173 58% 39%",
    "chart-3": "197 37% 24%",
    "chart-4": "43 74% 66%",
    "chart-5": "27 87% 67%",
    "radius": "0.5rem",
})

# Dark Theme
DARK_THEME = Theme("dark", {
    "background": "222.2 84% 4.9%",
    "foreground": "210 40% 98%",
    "card": "222.2 84% 4.9%",
    "card-foreground": "210 40% 98%",
    "popover": "222.2 84% 4.9%",
    "popover-foreground": "210 40% 98%",
    "primary": "210 40% 98%",
    "primary-foreground": "222.2 47.4% 11.2%",
    "secondary": "217.2 32.6% 17.5%",
    "secondary-foreground": "210 40% 98%",
    "muted": "217.2 32.6% 17.5%",
    "muted-foreground": "215 20.2% 65.1%",
    "accent": "217.2 32.6% 17.5%",
    "accent-foreground": "210 40% 98%",
    "destructive": "0 62.8% 30.6%",
    "destructive-foreground": "210 40% 98%",
    "border": "217.2 32.6% 17.5%",
    "input": "217.2 32.6% 17.5%",
    "ring": "212.7 26.8% 83.9%",
    "chart-1": "220 70% 50%",
    "chart-2": "160 60% 45%",
    "chart-3": "30 80% 55%",
    "chart-4": "280 65% 60%",
    "chart-5": "340 75% 55%",
    "radius": "0.5rem",
})

# Blue Theme
BLUE_THEME = Theme("blue", {
    "background": "0 0% 100%",
    "foreground": "222.2 84% 4.9%",
    "card": "0 0% 100%",
    "card-foreground": "222.2 84% 4.9%",
    "popover": "0 0% 100%",
    "popover-foreground": "222.2 84% 4.9%",
    "primary": "221.2 83.2% 53.3%",
    "primary-foreground": "210 40% 98%",
    "secondary": "210 40% 96%",
    "secondary-foreground": "222.2 47.4% 11.2%",
    "muted": "210 40% 96%",
    "muted-foreground": "215.4 16.3% 46.9%",
    "accent": "210 40% 96%",
    "accent-foreground": "222.2 47.4% 11.2%",
    "destructive": "0 84.2% 60.2%",
    "destructive-foreground": "210 40% 98%",
    "border": "214.3 31.8% 91.4%",
    "input": "214.3 31.8% 91.4%",
    "ring": "221.2 83.2% 53.3%",
    "chart-1": "12 76% 61%",
    "chart-2": "173 58% 39%",
    "chart-3": "197 37% 24%",
    "chart-4": "43 74% 66%",
    "chart-5": "27 87% 67%",
    "radius": "0.5rem",
})

# Green Theme
GREEN_THEME = Theme("green", {
    "background": "0 0% 100%",
    "foreground": "222.2 84% 4.9%",
    "card": "0 0% 100%",
    "card-foreground": "222.2 84% 4.9%",
    "popover": "0 0% 100%",
    "popover-foreground": "222.2 84% 4.9%",
    "primary": "142.1 76.2% 36.3%",
    "primary-foreground": "355.7 100% 97.3%",
    "secondary": "210 40% 96%",
    "secondary-foreground": "222.2 47.4% 11.2%",
    "muted": "210 40% 96%",
    "muted-foreground": "215.4 16.3% 46.9%",
    "accent": "210 40% 96%",
    "accent-foreground": "222.2 47.4% 11.2%",
    "destructive": "0 84.2% 60.2%",
    "destructive-foreground": "210 40% 98%",
    "border": "214.3 31.8% 91.4%",
    "input": "214.3 31.8% 91.4%",
    "ring": "142.1 76.2% 36.3%",
    "chart-1": "12 76% 61%",
    "chart-2": "173 58% 39%",
    "chart-3": "197 37% 24%",
    "chart-4": "43 74% 66%",
    "chart-5": "27 87% 67%",
    "radius": "0.5rem",
})

# Purple Theme
PURPLE_THEME = Theme("purple", {
    "background": "0 0% 100%",
    "foreground": "222.2 84% 4.9%",
    "card": "0 0% 100%",
    "card-foreground": "222.2 84% 4.9%",
    "popover": "0 0% 100%",
    "popover-foreground": "222.2 84% 4.9%",
    "primary": "262.1 83.3% 57.8%",
    "primary-foreground": "210 40% 98%",
    "secondary": "210 40% 96%",
    "secondary-foreground": "222.2 47.4% 11.2%",
    "muted": "210 40% 96%",
    "muted-foreground": "215.4 16.3% 46.9%",
    "accent": "210 40% 96%",
    "accent-foreground": "222.2 47.4% 11.2%",
    "destructive": "0 84.2% 60.2%",
    "destructive-foreground": "210 40% 98%",
    "border": "214.3 31.8% 91.4%",
    "input": "214.3 31.8% 91.4%",
    "ring": "262.1 83.3% 57.8%",
    "chart-1": "12 76% 61%",
    "chart-2": "173 58% 39%",
    "chart-3": "197 37% 24%",
    "chart-4": "43 74% 66%",
    "chart-5": "27 87% 67%",
    "radius": "0.5rem",
})

# Available themes
AVAILABLE_THEMES = {
    "default": DEFAULT_THEME,
    "dark": DARK_THEME,
    "blue": BLUE_THEME,
    "green": GREEN_THEME,
    "purple": PURPLE_THEME,
}


def get_theme(name: str = "default") -> Theme:
    """Get a theme by name"""
    return AVAILABLE_THEMES.get(name, DEFAULT_THEME)


def generate_theme_css(theme_name: str = "default") -> str:
    """Generate CSS for a specific theme"""
    theme = get_theme(theme_name)
    return f"""
:root {{
{theme.get_css_variables()}
}}

@media (prefers-color-scheme: dark) {{
  :root {{
{DARK_THEME.get_css_variables()}
  }}
}}

.dark {{
{DARK_THEME.get_css_variables()}
}}
"""
