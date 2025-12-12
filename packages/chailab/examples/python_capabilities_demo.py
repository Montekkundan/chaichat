"""
ChaiLab Python Capabilities Showcase
==================================

This demo showcases various Python capabilities that work seamlessly
with ChaiLab's shadcn/ui web interface. It demonstrates the power of
combining Python's extensive ecosystem with modern web UI design.

Features demonstrated:
• Regular expressions and text processing
• Data structures and algorithms
• File I/O operations
• System and environment interaction
• Mathematical computations
• Date/time manipulation
• JSON and data serialization
• Error handling and validation
• Performance benchmarking
• Random data generation
• String formatting and manipulation
"""

import chailab as cl
from chailab.ui import Input, Button, Card, CardHeader, CardTitle, CardContent
import os
import sys
import json
import re
import time
import random
import math
import platform
import psutil
from datetime import datetime, timedelta
import hashlib
import base64
import statistics

def python_capabilities_demo(capability_type, input_text, parameters):
    """Showcase various Python capabilities with shadcn/ui interface"""

    # Handle slider inputs (convert from list to single value)
    if parameters is None:
        parameters = ""
    elif isinstance(parameters, (list, tuple)):
        parameters = parameters[0] if parameters else ""

    results = []
    results.append("🐍 **Python Capabilities Showcase**")
    results.append("=" * 50)
    results.append(f"**Selected Capability:** {capability_type}")
    results.append("")

    if capability_type == "regex":
        results.append("🔍 **Regular Expressions & Text Processing**")
        results.append("-" * 45)

        if input_text:
            text = input_text
        else:
            text = "Contact us at support@example.com or sales@company.org. Visit https://www.python.org for more info!"

        results.append(f"**Input Text:** {text}")
        results.append("")

        # Email extraction
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        results.append(f"📧 **Emails Found:** {emails if emails else 'None'}")

        # URL extraction
        urls = re.findall(r'https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?', text)
        results.append(f"🔗 **URLs Found:** {urls if urls else 'None'}")

        # Phone numbers (basic pattern)
        phones = re.findall(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', text)
        results.append(f"📞 **Phone Numbers:** {phones if phones else 'None'}")

        # Word statistics
        words = re.findall(r'\b\w+\b', text)
        results.append(f"📊 **Text Stats:** {len(words)} words, {len(text)} characters")

        # Replace patterns
        if parameters:
            pattern, replacement = parameters.split('->', 1) if '->' in parameters else (parameters, '***')
            modified_text = re.sub(pattern, replacement, text)
            results.append(f"🔄 **Pattern Replacement:** {pattern} -> {replacement}")
            results.append(f"**Modified:** {modified_text}")

    elif capability_type == "data_structures":
        results.append("📊 **Data Structures & Algorithms**")
        results.append("-" * 40)

        # Demonstrate various data structures
        if input_text:
            data = input_text.split()
        else:
            data = ["apple", "banana", "cherry", "date", "elderberry"]

        results.append(f"**Input Data:** {data}")
        results.append("")

        # Lists
        results.append("📋 **List Operations:**")
        results.append(f"• Original: {data}")
        results.append(f"• Sorted: {sorted(data)}")
        results.append(f"• Reversed: {list(reversed(data))}")
        results.append(f"• Length: {len(data)}")

        # Sets
        results.append("🔄 **Set Operations:**")
        set1 = set(data[:3])
        set2 = set(data[2:])
        results.append(f"• Set 1: {set1}")
        results.append(f"• Set 2: {set2}")
        results.append(f"• Union: {set1 | set2}")
        results.append(f"• Intersection: {set1 & set2}")

        # Dictionary
        results.append("📚 **Dictionary Operations:**")
        word_lengths = {word: len(word) for word in data}
        results.append(f"• Word lengths: {word_lengths}")
        results.append(f"• Longest word: {max(word_lengths, key=word_lengths.get)}")

        # Sorting algorithms simulation
        results.append("⚡ **Sorting Demonstration:**")
        numbers = [random.randint(1, 100) for _ in range(8)]
        results.append(f"• Random numbers: {numbers}")
        results.append(f"• Sorted: {sorted(numbers)}")
        results.append(f"• Sum: {sum(numbers)}")
        results.append(f"• Average: {sum(numbers)/len(numbers):.1f}")

    elif capability_type == "file_operations":
        results.append("📁 **File & System Operations**")
        results.append("-" * 35)

        results.append("🔧 **System Information:**")
        results.append(f"• Platform: {platform.system()} {platform.release()}")
        results.append(f"• Python: {sys.version.split()[0]}")
        results.append(f"• Current Directory: {os.getcwd()}")
        results.append(f"• Python Executable: {sys.executable}")

        results.append("📂 **Directory Contents:**")
        try:
            files = os.listdir('.')
            py_files = [f for f in files if f.endswith('.py')]
            results.append(f"• Total files: {len(files)}")
            results.append(f"• Python files: {len(py_files)}")
            results.append(f"• Sample files: {files[:5]}")
        except Exception as e:
            results.append(f"• Error reading directory: {e}")

        results.append("📊 **Environment:**")
        results.append(f"• Environment variables: {len(dict(os.environ))}")
        results.append(f"• PATH entries: {len(os.environ.get('PATH', '').split(':'))}")

        # File creation demo
        if input_text:
            results.append("📝 **File Creation Demo:**")
            try:
                demo_content = f"Demo file created at {datetime.now()}\nContent: {input_text}"
                with open('/tmp/chailab_demo.txt', 'w') as f:
                    f.write(demo_content)
                results.append("• Demo file created successfully")
                results.append(f"• Content: {demo_content[:50]}...")
            except Exception as e:
                results.append(f"• File creation error: {e}")

    elif capability_type == "math_computing":
        results.append("🔢 **Mathematical Computing**")
        results.append("-" * 32)

        # Parse numbers from input
        if input_text:
            try:
                numbers = [float(x) for x in re.findall(r'[-+]?\d*\.?\d+', input_text)]
            except:
                numbers = [random.uniform(1, 100) for _ in range(10)]
        else:
            numbers = [random.uniform(1, 100) for _ in range(10)]

        results.append(f"**Numbers:** {['.1f' for x in numbers]}")
        results.append("")

        # Basic statistics
        results.append("📈 **Statistics:**")
        results.append(f"• Count: {len(numbers)}")
        results.append(f"• Sum: {sum(numbers):.2f}")
        results.append(f"• Mean: {statistics.mean(numbers):.2f}")
        results.append(f"• Median: {statistics.median(numbers):.2f}")
        results.append(f"• Mode: {statistics.mode(numbers) if len(set(numbers)) < len(numbers) else 'No unique mode':.2f}")
        results.append(f"• Standard Deviation: {statistics.stdev(numbers):.2f}")
        results.append(f"• Min: {min(numbers):.2f}")
        results.append(f"• Max: {max(numbers):.2f}")

        # Advanced math
        results.append("🧮 **Advanced Math:**")
        results.append(f"• Square root of first number: {math.sqrt(abs(numbers[0])):.2f}")
        results.append(f"• Logarithm (base 10): {math.log10(abs(numbers[0]) + 1):.2f}")
        results.append(f"• Sine of first number: {math.sin(math.radians(numbers[0])):.2f}")
        results.append(f"• Factorial of 5: {math.factorial(5)}")

        # Generate mathematical sequences
        results.append("🔄 **Mathematical Sequences:**")
        fibonacci = [0, 1]
        for i in range(8):
            fibonacci.append(fibonacci[-1] + fibonacci[-2])
        results.append(f"• Fibonacci: {fibonacci}")

        primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]
        results.append(f"• Prime numbers: {primes}")

    elif capability_type == "datetime":
        results.append("🕒 **Date & Time Operations**")
        results.append("-" * 30)

        now = datetime.now()
        results.append(f"**Current Time:** {now.strftime('%Y-%m-%d %H:%M:%S')}")
        results.append("")

        results.append("📅 **Date Operations:**")
        results.append(f"• Today: {now.date()}")
        results.append(f"• Tomorrow: {(now + timedelta(days=1)).date()}")
        results.append(f"• Yesterday: {(now - timedelta(days=1)).date()}")
        results.append(f"• Day of week: {now.strftime('%A')}")
        results.append(f"• Week number: {now.strftime('%U')}")
        results.append(f"• Month: {now.strftime('%B %Y')}")

        results.append("⏰ **Time Operations:**")
        results.append(f"• Current time: {now.strftime('%H:%M:%S')}")
        results.append(f"• UTC time: {datetime.utcnow().strftime('%H:%M:%S')} UTC")
        results.append(f"• Unix timestamp: {int(now.timestamp())}")
        results.append(f"• ISO format: {now.isoformat()}")

        # Time zone info
        results.append("🌍 **Time Zone Info:**")
        results.append(f"• Local timezone: {time.tzname[0] if hasattr(time, 'tzname') else 'Unknown'}")
        results.append(f"• DST active: {bool(time.daylight) if hasattr(time, 'daylight') else 'Unknown'}")

        # Date parsing demo
        if input_text:
            try:
                parsed_date = datetime.strptime(input_text, "%Y-%m-%d")
                results.append(f"📅 **Parsed Date:** {input_text}")
                results.append(f"• Day of week: {parsed_date.strftime('%A')}")
                results.append(f"• Days since: {(now - parsed_date).days}")
            except:
                results.append("📅 **Date parsing:** Use format YYYY-MM-DD")

    elif capability_type == "cryptography":
        results.append("🔐 **Cryptography & Security**")
        results.append("-" * 35)

        if input_text:
            text = input_text
        else:
            text = "ChaiLab with shadcn/ui interface"

        results.append(f"**Input Text:** {text}")
        results.append("")

        # Hash functions
        results.append("🔒 **Hash Functions:**")
        md5_hash = hashlib.md5(text.encode()).hexdigest()
        sha1_hash = hashlib.sha1(text.encode()).hexdigest()
        sha256_hash = hashlib.sha256(text.encode()).hexdigest()

        results.append(f"• MD5: {md5_hash}")
        results.append(f"• SHA1: {sha1_hash}")
        results.append(f"• SHA256: {md5_hash}")

        # Base64 encoding
        results.append("🔄 **Encoding/Decoding:**")
        b64_encoded = base64.b64encode(text.encode()).decode()
        b64_decoded = base64.b64decode(b64_encoded).decode()

        results.append(f"• Base64 encoded: {b64_encoded}")
        results.append(f"• Base64 decoded: {b64_decoded}")

        # Password strength checker
        results.append("🔑 **Password Strength Analysis:**")
        if len(text) >= 8:
            has_upper = bool(re.search(r'[A-Z]', text))
            has_lower = bool(re.search(r'[a-z]', text))
            has_digit = bool(re.search(r'\d', text))
            has_special = bool(re.search(r'[^A-Za-z0-9]', text))

            strength = sum([has_upper, has_lower, has_digit, has_special])
            strength_labels = ["Weak", "Fair", "Good", "Strong", "Very Strong"]
            results.append(f"• Password strength: {strength_labels[min(strength, 4)]}")
            results.append(f"• Length: {len(text)} characters")
            results.append(f"• Has uppercase: {'✓' if has_upper else '✗'}")
            results.append(f"• Has lowercase: {'✓' if has_lower else '✗'}")
            results.append(f"• Has digits: {'✓' if has_digit else '✗'}")
            results.append(f"• Has special chars: {'✓' if has_special else '✗'}")
        else:
            results.append("• Password too short (minimum 8 characters)")

    elif capability_type == "performance":
        results.append("⚡ **Performance & Benchmarking**")
        results.append("-" * 35)

        # Memory usage
        results.append("🧠 **Memory Information:**")
        try:
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()
            results.append(f"• Memory usage: {memory_info.rss / 1024 / 1024:.1f} MB")
            results.append(f"• Peak memory: {memory_info.peak_wss / 1024 / 1024:.1f} MB")
        except:
            results.append("• Memory info not available (psutil not installed)")

        # CPU information
        results.append("💻 **CPU Information:**")
        results.append(f"• CPU cores: {os.cpu_count()}")
        results.append(f"• Platform: {platform.machine()}")

        # Performance benchmarks
        results.append("🏁 **Performance Benchmarks:**")

        # String operations
        start_time = time.time()
        result = ""
        for i in range(10000):
            result += str(i)
        string_time = time.time() - start_time
        results.append(f"• String concatenation: {string_time:.4f}s")

        # List operations
        start_time = time.time()
        result = []
        for i in range(10000):
            result.append(i)
            result.pop()
        list_time = time.time() - start_time
        results.append(f"• List operations: {list_time:.4f}s")

        # Math operations
        start_time = time.time()
        result = 0
        for i in range(100000):
            result += math.sqrt(i)
        math_time = time.time() - start_time
        results.append(f"• Math operations: {math_time:.4f}s")

        # Random operations
        start_time = time.time()
        for i in range(10000):
            random.random()
        random_time = time.time() - start_time
        results.append(f"• Random generation: {random_time:.4f}s")

        results.append(f"**Total benchmark time:** {string_time + list_time + math_time + random_time:.4f}s")

    else:
        results.append("❓ **Unknown Capability**")
        results.append("-" * 25)
        results.append(f"Capability '{capability_type}' not recognized.")
        results.append("")
        results.append("Available capabilities:")
        results.append("• regex - Regular expressions & text processing")
        results.append("• data_structures - Lists, sets, dictionaries")
        results.append("• file_operations - File I/O and system info")
        results.append("• math_computing - Mathematical operations")
        results.append("• datetime - Date and time operations")
        results.append("• cryptography - Hashing and encoding")
        results.append("• performance - Benchmarking and profiling")

    results.append("")
    results.append("🎉 **Python Power Demonstrated!**")
    results.append("💡 This shows how ChaiLab bridges Python's ecosystem with modern web UI!")

    return "\n".join(results)

# Create the comprehensive demo interface
demo = cl.Interface(
    fn=python_capabilities_demo,
    inputs=[
        Input(
            placeholder="regex, data_structures, file_operations, math_computing, datetime, cryptography, performance",
            label="Python Capability",
            value="regex"
        ),
        Input(
            placeholder="Input text or data for processing...",
            label="Input Data",
            value="Python programming with ChaiLab and shadcn/ui interface!"
        ),
        Input(
            placeholder="Additional parameters (optional)",
            label="Parameters",
            value=""
        )
    ],
    outputs="text",
    title="🐍 Python Capabilities Showcase",
    description="Explore Python's full ecosystem with beautiful shadcn/ui interfaces! 🚀"
)

if __name__ == "__main__":
    print("🚀 Starting ChaiLab Python Capabilities Demo...")
    print("🐍 This demo showcases Python's capabilities:")
    print("  • Regular expressions and text processing")
    print("  • Data structures and algorithms")
    print("  • File operations and system information")
    print("  • Mathematical computing and statistics")
    print("  • Date/time manipulation")
    print("  • Cryptography and security")
    print("  • Performance benchmarking")
    print("  • All with beautiful shadcn/ui interface!")
    print()
    print("💡 Try these examples:")
    print("  • Capability: 'regex' - Text processing")
    print("  • Capability: 'math_computing' - Math operations")
    print("  • Capability: 'file_operations' - System info")
    print("  • Capability: 'performance' - Benchmarking")
    print()
    print("🌐 Open http://127.0.0.1:7860 in your browser")
    demo.launch()
