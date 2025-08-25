# ChaiLab

A Gradio-like interface using shadcn/ui-style components for building machine learning demos and web applications.

## Installation

### Using uv (recommended)

```bash
uv pip install chailab
```

### Using pip

```bash
pip install chailab
```

## Quickstart

Create a simple interface for your Python function:

```python
import chailab as cl

def greet(name, intensity):
    return "Hello, " + name + "!" * int(intensity)

demo = cl.Interface(
    fn=greet,
    inputs=["text", "slider"],
    outputs=["text"],
)

demo.launch()
```

## Features

- Simple API similar to Gradio
- Modern UI based on shadcn/ui
- FastAPI backend
- Components: textbox, slider, button, label, card (current scope)

## Components

ChaiLab supports various input and output components:

### Basic Components
- **Textbox**: Text input field
- **Slider**: Numeric slider input
- **Button**: Interactive button

### UI Components
- Input: form input with optional label and validation
- Label: accessible labels
- Card: layout container with header/content/footer
- Button: variants and sizes
- Slider: numeric range input

### Using shadcn/ui Components

```python
import chailab as cl
from chailab.ui import Input, Button, Card

demo = cl.Interface(
    fn=my_function,
    inputs=Input(
        placeholder="Enter your name...",
        label="Full Name",
        required=True
    ),
    outputs=cl.Textbox()
)
```

## Themes
The base stylesheet defines CSS variables compatible with shadcn/ui conventions. Theme customization will expand over time.

## Examples

### Basic Example

```python
import chailab as cl

def greet(name, intensity):
    return "Hello, " + name + "!" * int(intensity)

demo = cl.Interface(
    fn=greet,
    inputs=["text", "slider"],
    outputs=["text"],
    title="ChaiLab Greeting Demo",
    description="Enter your name and set the intensity level!"
)

demo.launch()
```

### UI Components Example

```python
import chailab as cl
from chailab.ui import Input, Button

def process_form(name, email):
    return f"Welcome {name}! Email: {email}"

demo = cl.Interface(
    fn=process_form,
    inputs=[
        Input(placeholder="Enter your name...", label="Name", required=True),
        Input(type="email", placeholder="your.email@example.com", label="Email")
    ],
    outputs=cl.Textbox(),
    title="Professional Form"
)

demo.launch()
```

## Development

To install for development:

```bash
git clone https://github.com/yourusername/chailab
cd chailab
uv sync
```

Or if you prefer pip:

```bash
git clone https://github.com/yourusername/chailab
cd chailab
pip install -e .
```

## Publish to PyPI (uv)

1. Set the version in `chailab/_version.py`.
2. Build:
   ```bash
   uv build
   ```
3. Publish (requires a PyPI token):
   ```bash
   uv publish --token "$PYPI_TOKEN"
   ```

For CLI and advanced flows, see uv docs.

## License

MIT License
