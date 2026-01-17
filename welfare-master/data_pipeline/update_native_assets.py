import json
import os


def update_native_assets():
    source_path = "master_database_v2_final.json"

    # Native Assets Paths
    native_dir = "../app/assets/separated_db"

    # Web Assets Paths
    web_dir = "../app/public"

    if not os.path.exists(source_path):
        print(f"Source file not found: {source_path}")
        return

    print(f"Loading {source_path}...")
    with open(source_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # ---------------------------------------------------------
    # 0. Normalize Categories
    # ---------------------------------------------------------
    def normalize_category(cat):
        if not cat:
            return cat
        # Old -> New Curriculum Mapping
        mapping = {
            "児童や家庭に対する支援と児童・家庭福祉制度": "児童・家庭福祉",
            "高齢者に対する支援と介護保険制度": "高齢者福祉",
            "障害者に対する支援と障害者自立支援制度": "障害者福祉",
            "低所得者に対する支援と生活保護制度": "貧困に対する支援",
            "相談援助の理論と方法": "ソーシャルワークの理論と方法",
            "相談援助の基盤と専門職": "ソーシャルワークの基盤と専門職",
            "地域福祉の理論と方法": "地域福祉と包括的支援体制",
        }
        return mapping.get(cat, cat)

    for q in data:
        if "categoryLabel" in q:
            q["categoryLabel"] = normalize_category(q["categoryLabel"])
        if "category_label" in q:
            q["category_label"] = normalize_category(q["category_label"])

    # ---------------------------------------------------------
    # 1. Prepare Data Subsets (with Backup Logic)
    # ---------------------------------------------------------

    # Common
    common_data = [q for q in data if q.get("group") in ["common", "common_social"]]

    # Past Social
    # Matches 'past_social' and 'past_social_XX'
    pass_social_data = [
        q for q in data if str(q.get("group")).startswith("past_social")
    ]

    # Daily
    daily_data = [q for q in data if not str(q.get("group")).startswith("past_")]

    # Spec Social - Primary Source
    spec_social_data = [q for q in data if q.get("group") == "spec_social"]

    print(f"Initial Spec Social Count: {len(spec_social_data)}")

    # RETRIEVE MISSING DATA FROM BACKUP if count is suspicious
    if len(spec_social_data) < 100:
        backup_path = "../app/public/web_spec_social_v2.json"
        if os.path.exists(backup_path):
            print(f"Retrieving missing spec_social data from {backup_path}...")
            with open(backup_path, "r", encoding="utf-8") as f:
                backup_data = json.load(f)

            # Filter ONLY spec_social from backup (Exclude past questions)
            # Exclude if group starts with past_
            # Exclude if ID starts with ps_ (past social)
            restored = []
            for q in backup_data:
                grp = q.get("group") or q.get("group_id")
                qid = q.get("id")

                # Check duplicates with existing data (avoid adding what we already have)
                # But here we assume we have nearly nothing.

                # Logic: Must be spec_social OR generic social, but NOT past.
                if str(grp).startswith("past"):
                    continue
                if str(qid).startswith("ps_"):
                    continue

                # If group is explicitly spec_social, take it.
                if (
                    grp == "spec_social" or grp is None
                ):  # None might be dangerous, check ID
                    if str(qid).startswith("ss_") or str(qid).startswith(
                        "social_"
                    ):  # social spec prefix?
                        restored.append(q)
                    # Or if backup has group 'spec_social', trust it
                    elif grp == "spec_social":
                        restored.append(q)

            print(f"Restored {len(restored)} items from backup.")
            spec_social_data = restored

    # Final Check
    print(f"Final Subset Counts:")
    print(f"  Common: {len(common_data)}")
    print(f"  Spec Social: {len(spec_social_data)}")
    print(f"  Past Social: {len(pass_social_data)}")
    print(f"  Daily Pool: {len(daily_data)}")

    # ---------------------------------------------------------
    # 2. Update Web Assets (app/public)
    # ---------------------------------------------------------

    def save_web(filename, d):
        path = os.path.join(web_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False)
        print(f"Saved {filename} ({len(d)})")

    save_web("web_common.json", common_data)
    save_web("web_spec_social_v3.json", spec_social_data)  # Clean spec only
    save_web("web_past_social.json", pass_social_data)  # Past only
    save_web("web_daily.json", daily_data)

    # ---------------------------------------------------------
    # 3. Update Native Assets (app/assets/separated_db)
    # ---------------------------------------------------------

    # Native needs master_social.json to have BOTH Spec and Past.
    # Common is separate.

    native_social_data = spec_social_data + pass_social_data

    with open(
        os.path.join(native_dir, "master_social.json"), "w", encoding="utf-8"
    ) as f:
        json.dump(native_social_data, f, ensure_ascii=False, indent=2)
    print(f"Saved master_social.json ({len(native_social_data)})")

    with open(
        os.path.join(native_dir, "master_common.json"), "w", encoding="utf-8"
    ) as f:
        json.dump(common_data, f, ensure_ascii=False, indent=2)
    print(f"Saved master_common.json ({len(common_data)})")


if __name__ == "__main__":
    update_native_assets()
