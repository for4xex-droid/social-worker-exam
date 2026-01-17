import json
import os
import shutil

# Paths
# Assuming running from data_pipeline directory
ASSETS_DIR = "../app/assets"
PUBLIC_DIR = "../app/public"
MASTER_DATA = os.path.join(ASSETS_DIR, "master_data.json")
MENTAL_PAST = os.path.join(ASSETS_DIR, "mental_past_questions.json")
FLASHCARDS = os.path.join(ASSETS_DIR, "flashcards.json")
# Fix: Use absolute path relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SSSC_PAST = os.path.join(BASE_DIR, "sssc_official_questions.json")
SOCIAL_R6 = os.path.join(BASE_DIR, "social_r6.json")


def load_json(path):
    print(f"Loading {path}...")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data, path):
    print(f"Saving {len(data)} items to {path}...")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"Saved {path} ({os.path.getsize(path) / 1024 / 1024:.2f} MB)")


def main():
    print("Preparing Web Assets...")

    # Ensure public dir exists
    if not os.path.exists(PUBLIC_DIR):
        os.makedirs(PUBLIC_DIR)

    # 1. Process Master Data -> Extract Common
    if os.path.exists(MASTER_DATA):
        master = load_json(MASTER_DATA)
        # Filter for common subjects
        common_questions = [
            q
            for q in master
            if q.get("group", "").startswith("common")
            or q.get("group_id", "").startswith("common")
        ]
        save_json(common_questions, os.path.join(PUBLIC_DIR, "web_common.json"))
    else:
        print("Master data not found!")

    # 2. Process Past Questions
    if os.path.exists(MENTAL_PAST):
        past = load_json(MENTAL_PAST)
        # Ensure group is set correctly for past questions
        for q in past:
            if not q.get("group"):
                q["group"] = "past_mental"
        save_json(past, os.path.join(PUBLIC_DIR, "web_past_mental.json"))
    else:
        print("Mental Past Questions not found!")

    # 3. Flashcards
    # 3. Flashcards
    if os.path.exists(FLASHCARDS):
        cards = load_json(FLASHCARDS)
        save_json(cards, os.path.join(PUBLIC_DIR, "web_cards.json"))
    else:
        print("Flashcards not found!")

    # 4. Mental Special (Split)
    MENTAL_SPECIAL = os.path.join(ASSETS_DIR, "mental_special.json")
    if os.path.exists(MENTAL_SPECIAL):
        print("Processing Mental Special...")
        special = load_json(MENTAL_SPECIAL)
        # Split into chunks of 1000 questions to match web memory limits
        chunk_size = 1000
        total_chunks = (len(special) + chunk_size - 1) // chunk_size
        print(f"Splitting {len(special)} items into {total_chunks} chunks...")

        for i in range(total_chunks):
            start = i * chunk_size
            end = start + chunk_size
            chunk = special[start:end]
            # Ensure group is set
            for q in chunk:
                if not q.get("group") and not q.get("group_id"):
                    q["group"] = "spec_mental"

            save_json(chunk, os.path.join(PUBLIC_DIR, f"web_spec_mental_{i}.json"))
    else:
        print("Mental Special not found!")

    # 5. Social Past AND Special (from SSSC)
    if os.path.exists(SSSC_PAST):
        print("Processing Social Past & Special...")
        sssc_data = load_json(SSSC_PAST)

        # 1. Past Exam Mode (Group by Year)
        past_social = []
        for i, q in enumerate(sssc_data):
            q_copy = q.copy()
            q_copy["group"] = "past_social"
            if "id" not in q_copy:
                q_copy["id"] = f"social_past_{i}"
            past_social.append(q_copy)
        save_json(past_social, os.path.join(PUBLIC_DIR, "web_past_social.json"))

        # 2. Specialized Subject Mode (Group by Category)
        # Use simple past questions fallback if extraction fails, but try extracting from Master first.
        # However, user says data EXISTS. So let's look for it in Master Data by Category.

    # 6. Social Special (Extract from Master Data)
    if os.path.exists(MASTER_DATA):
        print("Processing Social Special (from Master Data)...")
        # Load Master Data from multiple sources to recover missing Social Worker questions
        # Load Master Data from multiple sources to recover missing Social Worker questions
        # master_data.json might be optimized for Mental, so we check older backups (v3, v10) too.
        master_files = [
            "../app/assets/master_data.json",  # Current
            "../app/assets/master_database_v3.json",  # Backup with potential legacy data
            "../app/assets/master_database_v10_normalized.json",  # Another large backup
        ]

        master = []
        seen_texts = set()

        print("Loading and merging master data sources...")
        for mf in master_files:
            if os.path.exists(mf):
                print(f"  Loading {mf}...")
                try:
                    data = load_json(mf)
                    count_added = 0
                    for item in data:
                        # Deduplicate by question text content
                        q_text = item.get("question_text", "")
                        if q_text and len(q_text) > 10:
                            if q_text not in seen_texts:
                                master.append(item)
                                seen_texts.add(q_text)
                                count_added += 1
                    print(f"    Added {count_added} unique items.")
                except Exception as e:
                    print(f"    Error loading {mf}: {e}")

        print(f"Total unique questions loaded: {len(master)}")

        # Define mapping from Directory Name/Code to Unified Category (Based on user's folder structure)
        sw_folder_mapping = {
            "SW専1": "福祉サービスの組織と経営",
            "SW専2": "高齢者福祉",
            "SW専3": "児童・家庭福祉",
            "SW専4": "貧困に対する支援",
            "SW専5": "保健医療と福祉",
            "SW専6": "ソーシャルワークの理論と方法(社会専門)",
            "SW専7": "ソーシャルワーク演習(社会専門)",
        }

        # Define mapping for aggregation/normalization of category names (Fallback)
        social_spec_keywords = [
            ("福祉サービスの組織と経営", "福祉サービスの組織と経営"),
            ("高齢者福祉", "高齢者福祉"),
            ("高齢者に対する支援", "高齢者福祉"),
            ("介護保険制度", "高齢者福祉"),
            ("児童・家庭福祉", "児童・家庭福祉"),
            ("児童や家庭に対する支援", "児童・家庭福祉"),
            ("貧困に対する支援", "貧困に対する支援"),
            ("低所得者に対する支援", "貧困に対する支援"),
            ("保健医療と福祉", "保健医療と福祉"),
            ("保健医療サービス", "保健医療と福祉"),
            ("保健医療", "保健医療と福祉"),
            ("医学", "保健医療と福祉"),
            ("リハビリ", "保健医療と福祉"),
            ("ソーシャルワークの理論と方法", "ソーシャルワークの理論と方法(社会専門)"),
            ("ソーシャルワーク演習", "ソーシャルワーク演習(社会専門)"),
            ("児童", "児童・家庭福祉"),
            ("家庭福祉", "児童・家庭福祉"),
        ]

        spec_social = []
        for q in master:
            # Convert to string to search in ALL fields (path, source, etc.)
            q_str = json.dumps(q, ensure_ascii=False)
            matched_label = None

            # 1. Tracing by Folder Name (Strongest evidence)
            for sw_key, label in sw_folder_mapping.items():
                if sw_key in q_str:
                    matched_label = label
                    break

            # 2. Fallback: Tracing by Category Name
            if not matched_label:
                raw_cat = q.get("category_label", "") or ""
                for key, unified_label in social_spec_keywords:
                    if key in raw_cat:
                        matched_label = unified_label
                        break

            if matched_label:
                q_copy = q.copy()
                q_copy["group"] = "spec_social"
                q_copy["category_label"] = matched_label  # Normalize label
                # Ensure ID
                if "id" not in q_copy:
                    q_copy["id"] = f"soc_spec_{len(spec_social)}"
                spec_social.append(q_copy)

        if len(spec_social) > 0:
            print(
                f"Found {len(spec_social)} social specialized questions (aggregated)."
            )
            import collections

            cats = [x["category_label"] for x in spec_social]
            print("Category Counts:", collections.Counter(cats))

            # --- DEBUG: Dump ALL categories ---
            debug_cats = collections.Counter()
            for q in master:
                cat = q.get("category_label", "") or "NO_LABEL"
                debug_cats[cat] += 1

            with open("debug_all_cats.txt", "w", encoding="utf-8") as f:
                f.write("All Categories in Master Data:\n")
                for c, count in debug_cats.most_common():
                    f.write(f"{c}: {count}\n")
            # ------------------------------------------------

            save_json(spec_social, os.path.join(PUBLIC_DIR, "web_spec_social.json"))
        else:
            print(
                "No Social Special questions found in Master Data! Fallback to SSSC Past Data..."
            )
            # Fallback logic if extraction finds nothing (to avoid empty screen)
            spec_social_fallback = []
            if "sssc_data" in locals():
                for i, q in enumerate(sssc_data):
                    q_c = q.copy()
                    q_c["group"] = "spec_social"
                    if "id" not in q_c:
                        q_c["id"] = f"soc_spec_fb_{i}"
                    spec_social_fallback.append(q_c)
                save_json(
                    spec_social_fallback,
                    os.path.join(PUBLIC_DIR, "web_spec_social.json"),
                )

    # Removed old SSSC Special logic to prefer Master Data extraction


if __name__ == "__main__":
    main()
