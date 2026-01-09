import json
import sqlite3
import os

json_path = "master_database.json"
db_path = "social_welfare.db"
output_path = "master_database_restored.json"

YEAR_MAPPING = {
    "no31": "平成30年度",
    "no32": "令和元年度",
    "no33": "令和2年度",
    "no34": "令和3年度",
    "no35": "令和4年度",
    "no36": "令和5年度",
    "no37": "令和6年度",
    # Add if needed
}


def normalize_year(y):
    if not y or y == "全年度":
        return None
    if y in YEAR_MAPPING:
        return YEAR_MAPPING[y]
    if isinstance(y, str) and y.startswith("no"):
        try:
            val = int(y.replace("no", ""))
            return f"令和{val - 31}年度"
        except:
            pass
    return y


try:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    fixed_count = 0
    group_counts = {}

    # Pre-fetch DB map to speed up? 4000 items is small enough for one-by-one or dict loaded.
    # Let's load essential DB data into a dict
    cursor.execute("SELECT id, category, exam_year FROM questions")
    db_map = {str(row[0]): {"cat": row[1], "year": row[2]} for row in cursor.fetchall()}

    conn.close()

    for item in data:
        qid = str(item.get("id"))
        if qid in db_map:
            db_info = db_map[qid]
            raw_cat = db_info["cat"]
            raw_year = db_info["year"]

            norm_year = normalize_year(raw_year)

            # Logic to restore Past Exams
            if raw_cat == "社会福祉士":
                item["group"] = "past_social"

                # Manual fix for Social Worker Years based on ID ranges
                # Exam 36 (R5) starts ~ID 376
                # Exam 35 (R4) starts ~ID 162
                # Exam 34 (R3) starts ~ID 9 (currently labeled R4 in raw db)

                try:
                    q_id_int = int(qid)
                    if q_id_int >= 376:
                        item["year"] = "令和5年度"
                    elif q_id_int >= 162:
                        item["year"] = "令和4年度"
                    elif q_id_int >= 1:  # Covers Exam 34 (starts at 9)
                        item["year"] = "令和3年度"
                    else:
                        item["year"] = normalize_year(raw_year)
                except:
                    item["year"] = normalize_year(raw_year)

                if item["year"]:
                    fixed_count += 1
            elif raw_cat == "精神保健福祉士":
                item["group"] = "past_mental"
                item["year"] = norm_year
                if norm_year:
                    fixed_count += 1
            # Care worker?
            elif raw_cat == "介護福祉士":
                item["group"] = "past_kaigo"
                item["year"] = norm_year
                if norm_year:
                    fixed_count += 1

            # Common/Spec stay as prediction if year is "全年度"
            else:
                pass  # group already set correctly likely, year is None

            # Count groups
            g = item.get("group", "unknown")
            group_counts[g] = group_counts.get(g, 0) + 1

    print(f"Restored/Fixed years for {fixed_count} items.")
    print("Group stats:", group_counts)

    with open(json_path, "w", encoding="utf-8") as f:  # Overwrite directly
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("Updated master_database.json")

except Exception as e:
    print(f"Error: {e}")
