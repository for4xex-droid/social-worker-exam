import json
import os


def clean_data(input_file, output_file):
    if not os.path.exists(input_file):
        print(f"File not found: {input_file}")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Original total items: {len(data)}")

    seen_questions = set()
    cleaned_data = []

    # Also fix ID format if needed
    for item in data:
        if not isinstance(item, dict):
            continue

        # Use question text as the unique key
        q_text = item.get("question", "").strip()
        if not q_text:
            continue

        if q_text not in seen_questions:
            # Clean up ID - ensuring it looks like KAIGO_YEAR_ID
            raw_id = item.get("id", "unk")
            year = item.get("raw_year", "unknown").replace("no", "")
            final_id = f"K{year}_{raw_id}"

            item["id"] = final_id

            # Ensure categorization
            item["category_group"] = "過去問（介護）"

            # Map raw_year to a standard format if it's "no37" etc.
            if year.isdigit():
                item["year"] = f"第{year}回 (20{int(year) - 13}年度)"  # Approx

            cleaned_data.append(item)
            seen_questions.add(q_text)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=2)

    print(f"Cleaned items: {len(cleaned_data)}")
    return cleaned_data


if __name__ == "__main__":
    clean_data("raw_kaigo_questions.json", "raw_kaigo_questions_clean.json")
