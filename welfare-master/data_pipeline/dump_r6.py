import json

ASSET_FILE = "../app/assets/master_data.json"


def main():
    with open(ASSET_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("--- DUMPING R6 DATA ---")
    for i, q in enumerate(data):
        if q.get("year") == "令和6年度":
            # Format: Index | ID | Group | TextStart
            text = q.get("question_text", "")[:10].replace("\n", "")
            print(f"{i} | {q.get('id')} | {q.get('group')} | {text}")


if __name__ == "__main__":
    main()
