# ChaiLab + shadcn/ui Integration

ChaiLab now includes full shadcn/ui component integration, allowing you to create beautiful, themeable web interfaces with ease.

## What's New

### shadcn/ui Components
- **Button** - Multiple variants and sizes
- **Input** - Form inputs with validation
- **Label** - Accessible form labels
- **Card** - Layout containers with header, content, footer
- **Slider** - Range inputs with custom styling
- **And more coming soon!**

### Theme System
- **5 Built-in Themes**: Default, Dark, Blue, Green, Purple
- **CSS Custom Properties**: Dynamic theming without rebuilds
- **Easy Theme Switching**: Change appearance instantly
- **shadcn/ui Standards**: Follows established design patterns

## Quick Start with shadcn/ui

```python
import chailab as cl
from chailab.ui import Button, Input, Card, CardHeader, CardTitle

def greet(name):
    return f"Hello, {name}! Welcome to ChaiLab with shadcn/ui!"

# Use shadcn/ui components
demo = cl.Interface(
    fn=greet,
    inputs=Input(
        placeholder="Enter your name...",
        label="Full Name",
        required=True
    ),
    outputs=cl.Textbox(),
    title="shadcn/ui Demo",
    description="Experience beautiful, themed components!"
)

demo.launch()
```

## Component Library

### Button Component

```python
from chailab.ui import Button

# Different variants
Button("Click me", variant="default")      # Primary button
Button("Delete", variant="destructive")    # Red danger button
Button("Ghost", variant="ghost")           # Subtle button
Button("Outline", variant="outline")       # Border only
Button("Secondary", variant="secondary")   # Muted button

# Different sizes
Button("Small", size="sm")     # Small button
Button("Default", size="default")  # Standard size
Button("Large", size="lg")     # Large button
Button("Icon", size="icon")    # Square icon button
```

### Input Component

```python
from chailab.ui import Input

# Basic input
Input(placeholder="Enter text...")

# With label and validation
Input(
    placeholder="your.email@example.com",
    label="Email Address",
    type="email",
    required=True
)

# With error state
Input(
    placeholder="Enter value...",
    label="Input Field",
    error="This field is required"
)
```

### Card Components

```python
from chailab.ui import Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

# Complete card structure
Card(
    CardHeader(
        CardTitle("Card Title"),
        CardDescription("Card description text")
    ),
    CardContent(
        "Main content goes here"
    ),
    CardFooter(
        "Footer content"
    )
)
```

### Label Component

```python
from chailab.ui import Label

# Basic label
Label("Form Field Label")

# Required field label
Label("Required Field", required=True)

# Associated with input
Label("Email", html_for="email-input")
```

## Theme System

### Built-in Themes

```python
from chailab.themes import AVAILABLE_THEMES

# Available themes
print(list(AVAILABLE_THEMES.keys()))
# Output: ['default', 'dark', 'blue', 'green', 'purple']
```

### Using Themes

Themes are automatically applied via CSS custom properties. All components will automatically adapt to the selected theme.

```python
# The Interface automatically includes the default theme
# All components will use the theme colors
demo = cl.Interface(...)
demo.launch()  # Uses default theme
```

### Theme Colors

Each theme defines these CSS custom properties:

```css
--background: hsl(...);
--foreground: hsl(...);
--primary: hsl(...);
--primary-foreground: hsl(...);
--secondary: hsl(...);
--secondary-foreground: hsl(...);
--muted: hsl(...);
--muted-foreground: hsl(...);
--accent: hsl(...);
--accent-foreground: hsl(...);
--destructive: hsl(...);
--destructive-foreground: hsl(...);
--border: hsl(...);
--input: hsl(...);
--ring: hsl(...);
```

## Component API

### Base Component Properties

All shadcn/ui components inherit these properties:

```python
Component(
    class_name="custom-classes",  # Additional CSS classes
    **kwargs  # Component-specific properties
)
```

### Component Methods

```python
component = Button("Click me")

# Get component properties
props = component.get_props()

# Get CSS classes (for rendering)
classes = component.get_full_classes()
```

## Examples

### Complete Form with shadcn/ui

```python
import chailab as cl
from chailab.ui import Input, Label, Button, Card, CardHeader, CardTitle, CardContent

def process_form(name, email, age):
    return f"Welcome {name}! Email: {email}, Age: {age}"

form = cl.Interface(
    fn=process_form,
    inputs=[
        Input(
            placeholder="Enter your name...",
            label="Full Name",
            required=True
        ),
        Input(
            type="email",
            placeholder="your.email@example.com",
            label="Email Address",
            required=True
        ),
        cl.Slider(
            minimum=18,
            maximum=100,
            value=25,
            label="Age"
        )
    ],
    outputs=cl.Textbox(lines=3),
    title="Beautiful Form",
    description="A form built with shadcn/ui components"
)

form.launch()
```

### Theme Showcase

```python
import chailab as cl
from chailab.themes import AVAILABLE_THEMES

def show_theme(theme_name):
    theme = AVAILABLE_THEMES.get(theme_name, AVAILABLE_THEMES["default"])
    return f"Theme: {theme_name}\nColors: {list(theme.colors.keys())}"

theme_demo = cl.Interface(
    fn=show_theme,
    inputs=cl.Slider(
        minimum=0,
        maximum=4,
        value=0,
        label="Select Theme (0=Default, 1=Dark, 2=Blue, 3=Green, 4=Purple)"
    ),
    outputs=cl.Textbox(lines=8),
    title="Theme Explorer",
    description="Explore different shadcn/ui themes"
)

theme_demo.launch()
```

## Advanced Usage

### Custom Styling

```python
# Add custom CSS classes
Button(
    "Custom Button",
    class_name="my-custom-button hover:scale-105 transition-transform"
)

# Override component styles
Input(
    placeholder="Styled input...",
    class_name="border-2 border-purple-500 focus:border-purple-700"
)
```

### Component Composition

```python
# Create complex layouts
Card(
    CardHeader(
        CardTitle("User Profile"),
        CardDescription("User information and settings")
    ),
    CardContent(
        Input(label="Username", placeholder="Enter username"),
        Input(label="Email", type="email", placeholder="Enter email"),
        Button("Save Changes", variant="default")
    ),
    CardFooter(
        Button("Cancel", variant="outline", size="sm"),
        Button("Save", variant="default", size="sm")
    )
)
```

## Migration from Basic Components

### Old Way (Basic)
```python
# Old basic components
inputs = "text"
outputs = "textbox"
```

### New Way (shadcn/ui)
```python
# New shadcn/ui components
from chailab.ui import Input

inputs = Input(
    placeholder="Enter your text...",
    label="Text Input",
    required=True
)
outputs = cl.Textbox(label="Output")
```

## Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Button | Complete | All variants and sizes |
| Input | Complete | All input types, validation |
| Label | Complete | Accessible labels |
| Card | Complete | Header, content, footer |
| Slider | Complete | Range input with theming |
|  Textarea | In Progress | Multi-line text input |
|  Select | Planned | Dropdown selections |
|  Checkbox | Planned | Boolean inputs |
|  Radio | Planned | Single selection |
|  Switch | Planned | Toggle switches |
|  Badge | Planned | Status indicators |
|  Alert | Planned | Notification banners |
|  Dialog | Planned | Modal dialogs |
|  Sheet | Planned | Slide-out panels |
|  Tabs | Planned | Tabbed interfaces |
|  Accordion | Planned | Collapsible sections |
|  Progress | Planned | Progress indicators |
|  Avatar | Planned | User avatars |
|  Breadcrumb | Planned | Navigation breadcrumbs |
|  Pagination | Planned | Page navigation |
|  Table | Planned | Data tables |
|  Tooltip | Planned | Hover tooltips |
|  Popover | Planned | Hover/click popovers |
|  Dropdown Menu | Planned | Context menus |
|  Navigation Menu | Planned | Site navigation |
|  Menubar | Planned | Application menus |
|  Context Menu | Planned | Right-click menus |
|  Command | Planned | Command palette |
|  Combobox | Planned | Searchable dropdown |
|  Resizable | Planned | Resizable panels |
|  Scroll-area | Planned | Custom scrollbars |
|  Separator | Planned | Visual separators |
|  Skeleton | Planned | Loading placeholders |
|  Sonner | Planned | Toast notifications |
|  Toast | Planned | Toast notifications |
|  Toggle | Planned | Toggle buttons |
|  Toggle Group | Planned | Toggle button groups |
|  Aspect Ratio | Planned | Aspect ratio containers |
|  Collapsible | Planned | Collapsible content |
|  Hover Card | Planned | Hover cards |
|  Calendar | Planned | Date picker |
|  Date Picker | Planned | Date selection |
|  Chart | Planned | Data visualizations |
|  Data Table | Planned | Advanced data tables |
|  Input OTP | Planned | OTP input fields |
|  Menubar | Planned | Application menubars |
|  Navigation Menu | Planned | Site navigation |
|  Radio Group | Planned | Radio button groups |
|  Select | Planned | Selection dropdowns |
|  Sidebar | Planned | Application sidebar |
|  Typography | Planned | Text styling utilities |

## Contributing

Want to add more shadcn/ui components?

1. **Create Component**: Add new component in `chailab/ui/`
2. **Follow Patterns**: Use existing components as templates
3. **Add Tests**: Create tests in `tests/test_ui.py`
4. **Update Docs**: Add to this README
5. **Submit PR**: Share with the community

## Support

- **Documentation**: Check component docstrings
- **Examples**: See `examples/shadcn_demo.py`
- **Issues**: Report bugs or feature requests
- **Contributing**: Help add more components!

---
