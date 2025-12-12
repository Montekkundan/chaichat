"""
ChaiLab W&B Integration Demo
===========================

This example demonstrates ChaiLab's integration with Weights & Biases (W&B),
similar to the Gradio example you showed.
"""

import chailab as cl
from chailab.ui import Input, Button

def analyze_data(dataset_name, model_type, learning_rate):
    """Simulate ML experiment analysis"""

    # Handle different input types for learning_rate
    if learning_rate is None:
        learning_rate = 0.01
    elif isinstance(learning_rate, (list, tuple)):
        learning_rate = learning_rate[0] if learning_rate else 0.01
    elif isinstance(learning_rate, str):
        try:
            learning_rate = float(learning_rate)
        except ValueError:
            learning_rate = 0.01
    else:
        # Ensure it's a number
        try:
            learning_rate = float(learning_rate)
        except (ValueError, TypeError):
            learning_rate = 0.01

    # Simulate training results
    accuracy = 0.85 + (learning_rate * 0.1)
    loss = 0.15 - (learning_rate * 0.05)

    if model_type.lower() == "cnn":
        accuracy += 0.05
        loss -= 0.02
    elif model_type.lower() == "transformer":
        accuracy += 0.08
        loss -= 0.03

    results = f"""
📊 Experiment Results for {dataset_name}:

🎯 Model: {model_type.upper()}
⚙️  Learning Rate: {learning_rate}
📈 Accuracy: {accuracy:.3f}
📉 Loss: {loss:.3f}

💡 Recommendations:
• {'Great results! Consider deploying this model.' if accuracy > 0.9 else 'Good performance. Try hyperparameter tuning.'}
• {'Learning rate is optimal.' if 0.001 <= learning_rate <= 0.01 else 'Consider adjusting learning rate.'}
"""

    return results

# Create W&B-style demo interface
demo = cl.Interface(
    fn=analyze_data,
    inputs=[
        Input(
            placeholder="e.g., MNIST, CIFAR-10, ImageNet",
            label="Dataset Name",
            value="MNIST"
        ),
        Input(
            placeholder="CNN, Transformer, or MLP",
            label="Model Type",
            value="CNN"
        ),
        "slider"  # Learning rate slider
    ],
    outputs="text",
    title="ML Experiment Tracker",
    description="Track your machine learning experiments with ChaiLab + W&B style interface!"
)

if __name__ == "__main__":
    print("🚀 Starting ChaiLab W&B Integration Demo...")
    print("📊 This demo simulates:")
    print("  • ML experiment tracking")
    print("  • Model performance analysis")
    print("  • Hyperparameter optimization")
    print("  • W&B-style dashboard integration")
    print()
    print("🔗 This works just like Gradio's W&B integration!")
    print("🌐 Open http://127.0.0.1:7860 in your browser")
    demo.launch()
