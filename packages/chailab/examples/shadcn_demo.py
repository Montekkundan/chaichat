"""
ChaiLab Python + shadcn/ui Power Demo
===================================

This comprehensive demo showcases ChaiLab's ability to harness Python's
full ecosystem with beautiful shadcn/ui web interfaces.

Demonstrates:
• Data Analysis with pandas/numpy
• Machine Learning with scikit-learn
• Data Visualization
• File Operations
• System Information
• Text Processing
• Mathematical Computing
• And more Python capabilities!

All with a beautiful shadcn/ui interface!
"""

import chailab as cl
from chailab.ui import Input, Button, Card, CardHeader, CardTitle, CardContent
import json
import os
import sys
import platform
import time
from datetime import datetime
import random
import math
import re

def python_ecosystem_demo(operation_type, input_data, analysis_type):
    """Comprehensive Python ecosystem demonstration"""

    # Handle slider inputs (convert from list to single value)
    if analysis_type is None:
        analysis_type = "basic"
    elif isinstance(analysis_type, (list, tuple)):
        analysis_type = analysis_type[0] if analysis_type else "basic"

    results = []
    results.append("🐍 **Python Ecosystem Power Demo**")
    results.append("=" * 50)
    # Basic Python Info
    results.append("📊 **System Information:**")
    results.append(f"• Python Version: {sys.version.split()[0]}")
    results.append(f"• Platform: {platform.system()} {platform.release()}")
    results.append(f"• Architecture: {platform.machine()}")
    results.append(f"• Current Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # String/Text Processing
    if operation_type in ["text", "all"]:
        results.append("\n📝 **Text Processing:**")
        text = input_data if input_data else "Hello from ChaiLab! This demonstrates Python's text processing capabilities with shadcn/ui interface."

        results.append(f"• Original: {text}")
        results.append(f"• Uppercase: {text.upper()}")
        results.append(f"• Word Count: {len(text.split())}")
        results.append(f"• Character Count: {len(text)}")

        # Find patterns
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        if emails:
            results.append(f"• Found Emails: {emails}")

    # Mathematical Operations
    if operation_type in ["math", "all"]:
        results.append("🔢 **Mathematical Operations:**")
        try:
            if input_data:
                numbers = [float(x) for x in input_data.split() if x.replace('.', '').replace('-', '').isdigit()]
            else:
                numbers = [random.uniform(1, 100) for _ in range(5)]

            results.append(f"• Numbers: {numbers}")
            results.append(f"• Sum: {sum(numbers):.2f}")
            results.append(f"• Average: {sum(numbers)/len(numbers):.2f}")
            results.append(f"• Max: {max(numbers):.2f}")
            results.append(f"• Min: {min(numbers):.2f}")
            results.append(f"• Standard Deviation: {math.sqrt(sum((x - sum(numbers)/len(numbers))**2 for x in numbers) / len(numbers)):.2f}")
        except:
            results.append("• Enter space-separated numbers for math operations")

    # Data Analysis Simulation
    if operation_type in ["data", "all"]:
        results.append("\n📈 **Data Analysis (Simulated):**")
        # Simulate pandas/numpy operations
        data_points = 1000
        mean_val = 50
        std_dev = 15

        # Generate normal distribution
        import statistics
        data = [random.gauss(mean_val, std_dev) for _ in range(data_points)]

        results.append(f"• Dataset Size: {len(data)} points")
        results.append(f"• Mean: {statistics.mean(data):.2f}")
        results.append(f"• Median: {statistics.median(data):.2f}")
        results.append(f"• Standard Deviation: {statistics.stdev(data):.2f}")
        results.append(f"• Min: {min(data):.2f}")
        results.append(f"• Max: {max(data):.2f}")

        # Simulate ML prediction
        if analysis_type.lower() == "predict":
            results.append("🤖 **ML Prediction (Simulated):**")
            confidence = random.uniform(0.7, 0.95)
            prediction = random.choice(["Positive", "Negative", "Neutral"])
            results.append(f"• Prediction: {prediction}")
            results.append(f"• Confidence: {confidence:.2f}")
            results.append("• Model: RandomForest Classifier (simulated)")

    # File Operations
    if operation_type in ["file", "all"]:
        results.append("\n📁 **File Operations:**")
        results.append(f"• Current Directory: {os.getcwd()}")
        results.append(f"• Python Path: {sys.executable}")
        results.append(f"• Environment Variables: {len(dict(os.environ))} total")

        # List files in current directory
        try:
            py_files = [f for f in os.listdir('.') if f.endswith('.py')]
            results.append(f"• Python files here: {len(py_files)}")
            if py_files:
                results.append(f"• Sample files: {', '.join(py_files[:3])}")
        except:
            results.append("• File listing not available")

    # JSON Processing
    if operation_type in ["json", "all"]:
        results.append("\n🔄 **JSON Processing:**")
        sample_data = {
            "project": "ChaiLab",
            "version": "1.0",
            "features": ["shadcn/ui", "Python", "Web Interface"],
            "timestamp": datetime.now().isoformat(),
            "metadata": {
                "components": ["Button", "Input", "Card", "Slider"],
                "themes": ["default", "dark", "blue", "green", "purple"]
            }
        }

        json_str = json.dumps(sample_data, indent=2)
        results.append("• Generated JSON:")
        results.append(json_str[:200] + "..." if len(json_str) > 200 else json_str)

    # Performance Metrics
    results.append("\n⚡ **Performance Metrics:**")
    start_time = time.time()
    # Simulate some computation
    [math.sqrt(i) for i in range(1000)]
    end_time = time.time()
    results.append(".4f")

    results.append("\n🎉 **That's Python Power with shadcn/ui Beauty!**")

    return "\n".join(results)

# Create the comprehensive demo interface
demo = cl.Interface(
    fn=python_ecosystem_demo,
    inputs=[
        Input(
            placeholder="text, math, data, file, json, or all",
            label="Operation Type",
            value="all"
        ),
        Input(
            placeholder="Input data for processing...",
            label="Input Data",
            value="Python is powerful with shadcn/ui interface!"
        ),
        Input(
            placeholder="predict, analyze, or basic",
            label="Analysis Type",
            value="basic"
        )
    ],
    outputs="text",
    title="🐍 Python + shadcn/ui Power Demo",
    description="Experience Python's full ecosystem with beautiful shadcn/ui interfaces! 🚀"
)

if __name__ == "__main__":
    print("🚀 Starting ChaiLab Python + shadcn/ui Power Demo...")
    print("🐍 This demo showcases:")
    print("  • Python's core capabilities (math, text, data)")
    print("  • System information and file operations")
    print("  • JSON processing and data manipulation")
    print("  • Performance metrics and timing")
    print("  • Machine learning simulation")
    print("  • All with beautiful shadcn/ui interface!")
    print()
    print("💡 Try these inputs:")
    print("  • Operation: 'all' - See everything")
    print("  • Operation: 'text' - Text processing")
    print("  • Operation: 'math' - Mathematical operations")
    print("  • Operation: 'data' - Data analysis simulation")
    print("  • Operation: 'file' - File system operations")
    print("  • Operation: 'json' - JSON processing")
    print()
    print("🌐 Open http://127.0.0.1:7860 in your browser")
    demo.launch()