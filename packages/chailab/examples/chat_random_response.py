"""Random response chatbot demo using ChaiLab's ChatInterface."""

import random

import chailab as cl


def random_response(message: str, history):
    """Return a playful random answer regardless of the input."""

    choices = [
        "Absolutely!",
        "Not today.",
        "Maybe… ask again later?",
        "100% yes.",
        "I'm not sure—what do you think?",
    ]
    return random.choice(choices)


demo = cl.ChatInterface(
    fn=random_response,
    title="🎲 Random Response Bot",
    description="Every message gets a random answer. Perfect for demos and quick sanity checks.",
    placeholder="Ask me anything…",
)


if __name__ == "__main__":
    print("🚀 Launching Random Response Chat Demo on http://127.0.0.1:7860")
    demo.launch()
