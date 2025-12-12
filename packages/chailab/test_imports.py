#!/usr/bin/env python3
"""
Basic import check for ChaiLab (no emojis, minimal output)
"""

try:
    import chailab as cl
    print("ChaiLab import: OK")

    def test_func(x):
        return f"Result: {x}"

    demo = cl.Interface(fn=test_func, inputs="text", outputs="text", title="Test")
    print("Interface creation: OK")

    from chailab.ui import Input, Button  # noqa: F401
    print("UI components import: OK")

except Exception as e:
    print(f"Error: {e}")
