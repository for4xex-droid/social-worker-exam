import json


def cleanup():
    with open("master_database.json", "r", encoding="utf-8") as f:
        db = json.load(f)

    # Define what to REMOVE (the ones we confirmed are wrong or incomplete)
    # Social Worker R3, R4, R5 (confirmed wrong text)
    # Mental Health Worker R6 (confirmed incomplete count 110/132)

    new_db = []
    removed_counts = {}

    for q in db:
        g = q.get("group")
        y = q.get("year")

        should_remove = False
        if g == "past_social" and y in ["令和3年度", "令和4年度", "令和5年度"]:
            should_remove = True
        elif g == "past_mental" and y == "令和6年度":
            should_remove = True

        if should_remove:
            key = f"{g} {y}"
            removed_counts[key] = removed_counts.get(key, 0) + 1
        else:
            new_db.append(q)

    print("Removed items:")
    for k, v in removed_counts.items():
        print(f"  {k}: {v}")

    print(f"Total remaining: {len(new_db)}")

    with open("master_database.json", "w", encoding="utf-8") as f:
        json.dump(new_db, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    cleanup()
