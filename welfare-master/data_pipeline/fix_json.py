import json
import os

input_file = "master_database.json"
output_file = "master_database_fixed.json"

# Mapping for cleaning up year strings
YEAR_MAPPING = {
    "全年度": None,  # Remove year for AI predictions to group them correctly
    "no31": "平成30年度",
    "no32": "令和元年度",
    "no33": "令和2年度",
    "no34": "令和3年度",
    "no35": "令和4年度",
    "no36": "令和5年度",
    "no37": "令和6年度",
    # Add more if needed based on check_json output
}

# Groups that should definitely be treated as prediction (no year)
PREDICTION_GROUPS = ["common", "spec_social", "spec_mental", "spec_care"]

try:
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Loaded {len(data)} items to fix.")

    fixed_count = 0

    for item in data:
        original_year = item.get("year")
        group = item.get("group")

        # 1. Force year to None for prediction groups
        if group in PREDICTION_GROUPS:
            if item.get("year") is not None:
                item["year"] = None
                fixed_count += 1

        # 2. Normalize typical year strings for Past exams
        elif original_year:
            # Check mapping
            if original_year in YEAR_MAPPING:
                item["year"] = YEAR_MAPPING[original_year]
                fixed_count += 1

            # Handle "noXX" pattern generically if not in mapping
            elif isinstance(original_year, str) and original_year.startswith("no"):
                try:
                    num = int(original_year.replace("no", ""))
                    # Exam 36 = Reiwa 5 (2023 exam, for year 2023 intake, usually conducted Feb 2024? No, Feb 2024 is 36th)
                    # 36th = R5 fiscal year end?
                    # Let's align with existing mapping: no36 -> R5
                    reiwa_year = num - 31
                    if reiwa_year <= 0:
                        # Heisei calc... let's stick to simple mapping or keep as is if unsure
                        pass
                    else:
                        item["year"] = f"令和{reiwa_year}年度"
                        fixed_count += 1
                except:
                    pass

    print(f"Fixed {fixed_count} items.")

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Overwrite original for importer to pick up (or change importer target)
    # Let's overwrite safely
    import shutil

    shutil.move(output_file, input_file)
    print("Successfully updated master_database.json")

except Exception as e:
    print(f"Error: {e}")
