"""
ChaiLab Basic Example - Greeting App
===================================

This is the simplest ChaiLab example, similar to Gradio's quickstart.
It demonstrates how to create a basic interface with text input and output.
"""

import chailab as cl

def greet(name, intensity):
    """Greet someone with variable intensity"""
    return "Hello, " + name + "!" * int(intensity)

# Create the interface
demo = cl.Interface(
    fn=greet,
    inputs=["text", "slider"],
    outputs=["text"],
    title="ChaiLab Greeting Demo",
    description="Enter your name and set the intensity level to see a personalized greeting!"
)

if __name__ == "__main__":
    print("🚀 Starting ChaiLab Basic Greeting Demo...")
    print("📝 This demo shows text input and slider components")
    print("🌐 Open http://127.0.0.1:7860 in your browser")
    demo.launch()
