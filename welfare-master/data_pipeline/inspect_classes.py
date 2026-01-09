import re
from collections import Counter

try:
    with open("detail.html", "r", encoding="utf-8") as f:
        content = f.read()

    # Find all classes
    classes = re.findall(r'class=["\']([^"\']+)["\']', content)

    # Filter for interesting ones
    interesting = [
        c
        for c in classes
        if "question" in c or "choice" in c or "answer" in c or "text" in c
    ]

    print("Interesting Classes:")
    for c, count in Counter(interesting).most_common():
        print(f"{c}: {count}")

    # Check for IDs too
    ids = re.findall(r'id=["\']([^"\']+)["\']', content)
    print("\nIDs:")
    print(ids[:20])

except Exception as e:
    print(e)
