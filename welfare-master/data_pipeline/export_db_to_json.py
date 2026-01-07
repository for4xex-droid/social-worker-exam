import sqlite3
import json

def export_to_json(db_path, output_file):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 既存のカラムを取得
    cursor.execute("PRAGMA table_info(questions)")
    columns = [info[1] for info in cursor.fetchall()]
    
    has_category = 'category' in columns
    has_exam_year = 'exam_year' in columns

    query = "SELECT id, question_text, options, correct_answer, explanation"
    if has_category:
        query += ", category"
    if has_exam_year:
        query += ", exam_year"
    query += " FROM questions"

    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        
        data = []
        for row in rows:
            question = {
                "id": row[0],
                "question": row[1],
                "options": json.loads(row[2]) if row[2] else [],
                "correct_answer": json.loads(row[3]) if row[3] and row[3].startswith('[') else row[3], # Handle both string and list
                "explanation": row[4]
            }
            
            # Map database columns to raw_questions.json structure for processing
            category_val = row[5] if has_category else None
            exam_year_val = row[6] if has_exam_year else None
            
            # Determine 'category_group' based on logic (Simple mapping for now)
            # You can refine this logic based on your actual data content
            if category_val == "社会福祉士" and exam_year_val and "過去問" in exam_year_val:
                 question["category_group"] = "過去問（社会）"
            elif category_val == "精神保健福祉士" and exam_year_val and "過去問" in exam_year_val:
                 question["category_group"] = "過去問（精神）"
            elif category_val == "社会福祉士":
                 question["category_group"] = "専門（社会）" # Default for social
            elif category_val == "精神保健福祉士":
                 question["category_group"] = "専門（精神）" # Default for mental
            else:
                 question["category_group"] = "共通" # Default fallback
            
            # Keep original raw data just in case
            question["raw_category"] = category_val
            question["raw_year"] = exam_year_val

            data.append(question)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Exported {len(data)} questions to {output_file}")
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    export_to_json("social_welfare.db", "raw_questions.json")
