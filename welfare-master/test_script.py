print("Python is alive")
try:
    with open("test_log.txt", "w", encoding="utf-8") as f:
        f.write("File write works")
    print("File write success")
except Exception as e:
    print(f"File write failed: {e}")
