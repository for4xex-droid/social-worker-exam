import json
import os
import sys

# Force UTF-8 for stdout just in case, though we primarily write to file
try:
    sys.stdout.reconfigure(encoding="utf-8")
except:
    pass

targets = [
    "app/assets/master_database_v3.json",
    "app/assets/master_data.json",  # Current
    "app/assets/master_database_v13_mental.json",
]

log_file = "scan_result_final.txt"

with open(log_file, "w", encoding="utf-8") as log:

    def print_log(msg):
        print(msg)
        log.write(msg + "\n")

    for t in targets:
        if not os.path.exists(t):
            print_log(f"{t} not found")
            continue

        print_log(f"Scanning {t}...")
        try:
            with open(t, "r", encoding="utf-8") as f:
                data = json.load(f)

            sw_count = 0
            health_count = 0

            # Simple keyword check
            for q in data:
                try:
                    s = json.dumps(q, ensure_ascii=False)
                    if "SW専" in s:
                        sw_count += 1
                    if "保健医療と福祉" in s:
                        health_count += 1
                except:
                    pass

            print_log(f"  Total Records: {len(data)}")
            print_log(f"  'SW専' hits: {sw_count}")
            print_log(f"  '保健医療と福祉' hits: {health_count}")
        except Exception as e:
            print_log(f"  Error scanning {t}: {e}")

print("Scan complete.")
