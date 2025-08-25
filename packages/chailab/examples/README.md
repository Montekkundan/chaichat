# ChaiLab Examples

This folder contains essential examples to help you get started with ChaiLab. We've kept it simple with just the most important examples.

## Example Files

### Basic Examples

#### `basic_greeting.py`
- **Description**: The simplest ChaiLab example - a greeting app
- **Features**: Text input, slider component, basic function wrapping
- **Perfect for**: First-time users learning the basics

### Advanced Examples

#### `shadcn_demo.py`
- **Description**: Comprehensive Python ecosystem showcase
- **Features**: System info, text processing, math operations, file I/O, JSON processing, ML simulation
- **Perfect for**: Demonstrating Python's full capabilities with shadcn/ui

#### `python_capabilities_demo.py`
- **Description**: Advanced Python capabilities demonstration
- **Features**: Regex, data structures, cryptography, datetime, performance benchmarking
- **Perfect for**: Showing Python's extensive standard library capabilities

#### `data_analysis_demo.py`
- **Description**: Data science and machine learning showcase
- **Features**: Statistical analysis, distributions, correlation, ML simulation, visualization
- **Perfect for**: Data analysis and machine learning workflows

#### `wandb_demo.py`
- **Description**: ML experiment tracking demo (like Gradio + W&B)
- **Features**: Model analysis, hyperparameter tuning, experiment tracking
- **Perfect for**: Machine learning workflows and experiment tracking

### Jupyter Notebook

#### `chailab_quickstart.ipynb`
- **Description**: Interactive notebook with step-by-step tutorials
- **Features**: Code cells you can run, explanations, and examples
- **Perfect for**: Learning ChaiLab in an interactive environment

## ChaiLab's Unique Advantage

ChaiLab combines **Python's full ecosystem** with **beautiful shadcn/ui web interfaces**:

### **What Makes ChaiLab Special:**
- **Full Python Access**: Use any Python library, module, or capability
- **Beautiful UI**: Professional shadcn/ui components with 5 themes
- **Easy Integration**: Works with existing Python code seamlessly
- **Responsive Design**: Looks great on all devices
- **Fast Development**: Quick prototyping with familiar API
- **Ecosystem Compatible**: Integrates with W&B, pandas, numpy, etc.

### **Python Capabilities Demonstrated:**
- **System Operations**: Platform info, file I/O, environment variables
- **Data Processing**: Statistics, algorithms, data structures
- **Text Analysis**: Regular expressions, pattern matching
- **Mathematical Computing**: Statistics, numerical operations
- **Date/Time Handling**: Time zones, formatting, calculations
- **Security**: Hashing, encoding, password analysis
- **Performance**: Benchmarking, memory usage, optimization
- **Machine Learning**: Model simulation, feature engineering
- **Data Visualization**: Charts, plots, statistical graphics

## Getting Started

### Prerequisites

Make sure you have ChaiLab installed:

```bash
# Using uv (recommended)
uv pip install chailab

# Using pip
pip install chailab
```

### Running Examples

#### Option 1: Run Python Files Directly

```bash
# Navigate to the examples directory
cd examples

# Run any example
python basic_greeting.py
python text_processor.py
python math_calculator.py
python advanced_features.py

# Or use the example runner
python run_example.py
```

Each example will:
1. Start a web server on `http://127.0.0.1:7860`
2. Open your browser automatically
3. Display the ChaiLab interface

#### Option 2: Using Jupyter Notebook

```bash
# Install Jupyter if you haven't already
pip install jupyter

# Navigate to the examples directory
cd examples

# Start Jupyter
jupyter notebook

# Or use JupyterLab
pip install jupyterlab
jupyter lab
```

Then open `chailab_quickstart.ipynb` in your browser.

#### Option 3: Using VS Code

If you have VS Code with the Jupyter extension:
1. Open the `examples` folder in VS Code
2. Open `chailab_quickstart.ipynb`
3. Click "Run All" or run cells individually

## Learning Path

### 1. Start with Basics (15 minutes)
- Run `basic_greeting.py`
- Understand the `Interface` class
- Learn about inputs and outputs

### 2. Explore Components (20 minutes)
- Run `text_processor.py`
- Learn about different component types
- Understand component properties

### 3. Master Sliders and Math (25 minutes)
- Run `math_calculator.py`
- Learn slider configuration
- Understand mathematical functions

### 4. Advanced Features (30+ minutes)
- Run `advanced_features.py`
- Learn complex input handling
- Understand error handling and validation

### 5. Interactive Learning (45 minutes)
- Open `chailab_quickstart.ipynb`
- Follow the step-by-step tutorial
- Experiment with the code cells

## Troubleshooting

### Common Issues

#### "Module 'chailab' not found"
```bash
# Make sure ChaiLab is installed
pip install chailab

# Or if using uv
uv pip install chailab
```

#### "Port 7860 is already in use"
ChaiLab will automatically find an available port, or you can specify a different port:

```python
demo.launch(port=7861)  # Use port 7861 instead
```

#### "Browser doesn't open automatically"
Some environments don't support automatic browser opening. You can:
1. Check the terminal output for the URL
2. Manually open your browser and navigate to `http://127.0.0.1:7860`

#### "Function execution errors"
- Check your function logic
- Ensure inputs match function parameters
- Add error handling with try/except blocks

## Example Features Demonstrated

### Components
- `Textbox`: Text input with customizable properties
- `Slider`: Numeric input with min/max values
- `Button`: Interactive buttons (in component definitions)

### Interface Options
- Multiple inputs and outputs
- Custom titles and descriptions
- Different component configurations

### Function Patterns
- Simple functions with single parameters
- Functions with multiple parameters
- Functions returning formatted strings
- Error handling and validation

### Real-world Use Cases
- Form processing and validation
- Mathematical calculations
- Text analysis and processing
- Data formatting and conversion

## Contributing

Have an interesting example? We'd love to see it!

### Adding a New Example

1. Create your example file in this directory
2. Follow the naming convention: `descriptive_name.py`
3. Include comprehensive docstrings
4. Add error handling where appropriate
5. Update this README with your example

### Example Template

```python
"""
Brief description of your example
================================

What this example demonstrates and why it's useful.
"""

import chailab as cl

def your_function(param1, param2):
    """Function docstring"""
    # Your implementation
    return result

# Create interface
demo = cl.Interface(
    fn=your_function,
    inputs=[...],  # Your inputs
    outputs=[...], # Your outputs
    title="Your Demo Title",
    description="Brief description of what this does"
)

if __name__ == "__main__":
    print("Starting your demo...")
    demo.launch()
```

## Testing Your Installation

Before running examples, you might want to verify your ChaiLab installation:

```bash
# Navigate to the tests directory
cd tests

# Run the integration tests
python test_installation.py

# Or run all unit tests
pytest
```

## Next Steps

After exploring these examples, you might want to:

1. **Read the Documentation**: Learn about all available components and features
2. **Build Your Own Apps**: Create interfaces for your own functions
3. **Run Tests**: Check the `tests/` directory for comprehensive test suites
4. **Share Your Creations**: Deploy your apps or share them with others
5. **Contribute**: Help improve ChaiLab by reporting issues or contributing code

## Support

If you have questions or need help:
- Check the main ChaiLab documentation
- Look at the source code in the `chailab/` directory
- Create an issue in the GitHub repository
- Ask the community

Happy building with ChaiLab!
