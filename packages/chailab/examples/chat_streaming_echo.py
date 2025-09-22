"""Streaming-like echo chatbot demonstrating generator support."""

import time

import chailab as cl


def slow_echo(message: str, history):
    """Yield partial responses to simulate typing latency."""

    for index in range(len(message)):
        time.sleep(0.05)
        yield "You typed: " + message[: index + 1]


demo = cl.ChatInterface(
    fn=slow_echo,
    title="⌛ Slow Echo Chat",
    description="Shows how generator functions can feed incremental responses.",
    placeholder="Type something slowly…",
    save_history=True,
)


if __name__ == "__main__":
    print("🚀 Launching Slow Echo Chat Demo on http://127.0.0.1:7860")
    demo.launch()
