use crate::models::{AnswerSubmission, Question, LearningStats, CategoryStats, UserSyncData, UserProgressRow, LearningHistoryRow};
use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection, Result};
use serde_json;

pub fn get_learning_stats(user_id: i64) -> Result<LearningStats> {
    let conn = Connection::open(DB_PATH)?;
    
    // Total Questions (Static)
    let total: i32 = conn.query_row(
        "SELECT COUNT(*) FROM questions", 
        [], 
        |row| row.get(0)
    )?;
    
    // Total Mastered (User-specific)
    let mastered: i32 = conn.query_row(
        "SELECT COUNT(*) FROM user_progress WHERE user_id = ?1 AND status = 'mastered'", 
        params![user_id], 
        |row| row.get(0)
    )?;
    
    // Category Stats
    let mut stmt = conn.prepare(
        "SELECT q.category, COUNT(q.id), CAST(SUM(CASE WHEN p.status='mastered' THEN 1 ELSE 0 END) AS INTEGER)
         FROM questions q
         LEFT JOIN user_progress p ON q.id = p.question_id AND p.user_id = ?1
         GROUP BY q.category"
    )?;
    
    let cat_iter = stmt.query_map(params![user_id], |row| {
        Ok(CategoryStats {
            category: row.get::<_, Option<String>>(0)?.unwrap_or("未分類".to_string()),
            total: row.get::<_, i32>(1)?,
            mastered: row.get::<_, Option<i32>>(2)?.unwrap_or(0),
        })
    })?;
    
    let mut category_stats = Vec::new();
    for c in cat_iter {
        category_stats.push(c?);
    }
    
    Ok(LearningStats {
        total_questions: total,
        mastered_questions: mastered,
        category_stats,
    })
}

const DB_PATH: &str = "../social_welfare.db";

pub fn init_db() -> Result<()> {
    let conn = Connection::open(DB_PATH)?;

    // Core questions table (Static content)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY,
            question_text TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            explanation TEXT,
            source_file TEXT,
            category TEXT,
            exam_year TEXT
        )",
        [],
    )?;

    // Users table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
        )",
        [],
    )?;

    // User progress table (Mutable per user)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_progress (
            user_id INTEGER,
            question_id INTEGER,
            status TEXT DEFAULT 'new',
            next_review_at TEXT,
            correct_streak INTEGER DEFAULT 0,
            last_reviewed_at TEXT,
            PRIMARY KEY (user_id, question_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (question_id) REFERENCES questions(id)
        )",
        [],
    )?;

    // Learning history for graphs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS learning_history (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            question_id INTEGER,
            timestamp TEXT NOT NULL,
            is_correct BOOLEAN,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (question_id) REFERENCES questions(id)
        )",
        [],
    )?;

    // Migration: If old columns exist in questions, we might want to drop them later
    // but for now let's just ensure indices and base data
    let _ = conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_question_text ON questions(question_text)", []);

    // Create default user if none exist
    let user_count: i32 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
    if user_count == 0 {
        conn.execute("INSERT INTO users (name) VALUES ('Default User')", [])?;
    }

    // User sessions to save current position (per mode)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_sessions (
            user_id INTEGER,
            mode TEXT,
            last_question_id INTEGER,
            PRIMARY KEY (user_id, mode)
        )",
        [],
    )?;

    Ok(())
}

pub fn get_users() -> Result<Vec<crate::models::User>> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare("SELECT id, name FROM users")?;
    let user_iter = stmt.query_map([], |row| {
        Ok(crate::models::User {
            id: row.get(0)?,
            name: row.get(1)?,
        })
    })?;
    user_iter.collect()
}

pub fn create_user(name: String) -> Result<i64> {
    let conn = Connection::open(DB_PATH)?;
    conn.execute("INSERT INTO users (name) VALUES (?1)", params![name])?;
    Ok(conn.last_insert_rowid())
}

pub fn get_questions_due_today(user_id: i64) -> Result<Vec<Question>> {
    let conn = Connection::open(DB_PATH)?;
    let now = Utc::now();

    let mut stmt = conn.prepare(
        "SELECT q.id, q.question_text, q.options, q.correct_answer, q.explanation, q.source_file, 
                COALESCE(p.status, 'new'), p.next_review_at, COALESCE(p.correct_streak, 0), p.last_reviewed_at, q.category, q.exam_year
         FROM questions q
         LEFT JOIN user_progress p ON q.id = p.question_id AND p.user_id = ?1
         WHERE COALESCE(p.status, 'new') != 'mastered' 
         AND (p.next_review_at IS NULL OR p.next_review_at <= ?2)
         ORDER BY p.next_review_at ASC
         LIMIT 20"
    )?;

    map_questions(&mut stmt, params![user_id, now.to_rfc3339()])
}

pub fn get_all_questions(user_id: i64) -> Result<Vec<Question>> {
    let conn = Connection::open(DB_PATH)?;
    
    let mut stmt = conn.prepare(
        "SELECT q.id, q.question_text, q.options, q.correct_answer, q.explanation, q.source_file, 
                COALESCE(p.status, 'new'), p.next_review_at, COALESCE(p.correct_streak, 0), p.last_reviewed_at, q.category, q.exam_year
         FROM questions q
         LEFT JOIN user_progress p ON q.id = p.question_id AND p.user_id = ?1
         ORDER BY q.id DESC"
    )?;

    map_questions(&mut stmt, params![user_id])
}

pub fn get_questions_by_category(category: String, user_id: i64) -> Result<Vec<Question>> {
    let conn = Connection::open(DB_PATH)?;
    
    let mut stmt = conn.prepare(
        "SELECT q.id, q.question_text, q.options, q.correct_answer, q.explanation, q.source_file, 
                COALESCE(p.status, 'new'), p.next_review_at, COALESCE(p.correct_streak, 0), p.last_reviewed_at, q.category, q.exam_year
         FROM questions q
         LEFT JOIN user_progress p ON q.id = p.question_id AND p.user_id = ?1
         WHERE q.category = ?2
         ORDER BY q.id DESC"
    )?;

    map_questions(&mut stmt, params![user_id, category])
}

pub fn get_wrong_questions(user_id: i64) -> Result<Vec<Question>> {
    let conn = Connection::open(DB_PATH)?;
    
    let mut stmt = conn.prepare(
        "SELECT q.id, q.question_text, q.options, q.correct_answer, q.explanation, q.source_file, 
                COALESCE(p.status, 'new'), p.next_review_at, COALESCE(p.correct_streak, 0), p.last_reviewed_at, q.category, q.exam_year
         FROM questions q
         LEFT JOIN user_progress p ON q.id = p.question_id AND p.user_id = ?1
         WHERE COALESCE(p.status, 'new') = 'learning' AND COALESCE(p.correct_streak, 0) = 0
         ORDER BY p.last_reviewed_at DESC"
    )?;

    map_questions(&mut stmt, params![user_id])
}

// 共通のマッピング処理
fn map_questions<P>(stmt: &mut rusqlite::Statement, params: P) -> Result<Vec<Question>> 
where P: rusqlite::Params 
{
    let question_iter = stmt.query_map(params, |row| {
        let options_json: String = row.get(2)?;
        let options: Vec<String> = serde_json::from_str(&options_json).unwrap_or_default();

        let next_review_str: Option<String> = row.get(7)?;
        let next_review_at = next_review_str
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc));

        let last_reviewed_str: Option<String> = row.get(9)?;
        let last_reviewed_at = last_reviewed_str
            .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
            .map(|dt| dt.with_timezone(&Utc));

        let correct_answer_raw: String = row.get(3)?;
        let correct_answer: Vec<String> = if correct_answer_raw.starts_with('[') {
            serde_json::from_str(&correct_answer_raw).unwrap_or_else(|_| vec![correct_answer_raw])
        } else {
            vec![correct_answer_raw]
        };

        Ok(Question {
            id: Some(row.get(0)?),
            question_text: row.get(1)?,
            options,
            correct_answer,
            explanation: row.get(4)?,
            source_file: row.get(5)?,
            status: row.get(6)?,
            next_review_at,
            correct_streak: row.get(8)?,
            last_reviewed_at,
            category: row.get(10).ok().flatten(),
            exam_year: row.get(11).ok().flatten(),
        })
    })?;

    let mut questions = Vec::new();
    for question in question_iter {
        questions.push(question?);
    }
    Ok(questions)
}

pub fn register_result(submission: AnswerSubmission) -> Result<()> {
    let conn = Connection::open(DB_PATH)?;
    let now = Utc::now();

    // 現在の状態を取得 (user_progressから)
    let mut stmt = conn.prepare("SELECT correct_streak FROM user_progress WHERE user_id = ?1 AND question_id = ?2")?;
    let current_streak: i32 = stmt.query_row(params![submission.user_id, submission.question_id], |row| row.get(0)).unwrap_or(0);

    let (new_streak, next_review_days) = if submission.is_correct {
        let new_streak = current_streak + 1;
        let days = 2_i64.pow(new_streak.min(10) as u32);
        (new_streak, days)
    } else {
        (0, 0)
    };

    let next_review_at = if next_review_days == 0 {
        now 
    } else {
        now + Duration::days(next_review_days)
    };

    let status = if new_streak >= 5 {
        "mastered"
    } else {
        "learning"
    };

    conn.execute(
        "INSERT INTO user_progress (user_id, question_id, status, correct_streak, next_review_at, last_reviewed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(user_id, question_id) DO UPDATE SET
            status = excluded.status,
            correct_streak = excluded.correct_streak,
            next_review_at = excluded.next_review_at,
            last_reviewed_at = excluded.last_reviewed_at",
        params![
            submission.user_id,
            submission.question_id,
            status,
            new_streak,
            next_review_at.to_rfc3339(),
            now.to_rfc3339()
        ],
    )?;

    // Log to history
    conn.execute(
        "INSERT INTO learning_history (user_id, question_id, timestamp, is_correct)
         VALUES (?1, ?2, ?3, ?4)",
        params![
            submission.user_id,
            submission.question_id,
            now.to_rfc3339(),
            submission.is_correct
        ],
    )?;

    Ok(())
}

pub fn get_study_history(user_id: i64) -> Result<Vec<(String, i32)>> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare(
        "SELECT strftime('%Y-%m-%d', timestamp), COUNT(*) 
         FROM learning_history 
         WHERE user_id = ?1 
         GROUP BY strftime('%Y-%m-%d', timestamp) 
         ORDER BY timestamp DESC LIMIT 14"
    )?;
    let rows = stmt.query_map(params![user_id], |row| {
        let date: String = row.get(0)?;
        let count: i32 = row.get(1)?;
        Ok((date, count))
    })?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

pub fn export_user_data(user_id: i64) -> Result<String> {
    let conn = Connection::open(DB_PATH)?;
    
    // Progress
    let mut stmt = conn.prepare("SELECT question_id, status, next_review_at, correct_streak, last_reviewed_at FROM user_progress WHERE user_id = ?1")?;
    let progress_rows = stmt.query_map(params![user_id], |row| {
        Ok(UserProgressRow {
            question_id: row.get(0)?,
            status: row.get(1)?,
            next_review_at: row.get(2)?,
            correct_streak: row.get(3)?,
            last_reviewed_at: row.get(4)?,
        })
    })?;
    let mut progress = Vec::new();
    for r in progress_rows { progress.push(r?); }
    
    // History
    let mut stmt = conn.prepare("SELECT question_id, timestamp, is_correct FROM learning_history WHERE user_id = ?1")?;
    let history_rows = stmt.query_map(params![user_id], |row| {
        Ok(LearningHistoryRow {
            question_id: row.get(0)?,
            timestamp: row.get(1)?,
            is_correct: row.get(2)?,
        })
    })?;
    let mut history = Vec::new();
    for r in history_rows { history.push(r?); }
    
    let data = UserSyncData { progress, history };
    Ok(serde_json::to_string(&data).unwrap_or_default())
}

pub fn import_user_data(user_id: i64, data_json: String) -> Result<()> {
    let mut conn = Connection::open(DB_PATH)?;
    let data: UserSyncData = serde_json::from_str(&data_json).map_err(|_| rusqlite::Error::InvalidQuery)?;
    
    let tx = conn.transaction()?;
    
    // Clear existing for this user
    tx.execute("DELETE FROM user_progress WHERE user_id = ?1", params![user_id])?;
    tx.execute("DELETE FROM learning_history WHERE user_id = ?1", params![user_id])?;
    
    // Insert Progress
    for p in data.progress {
        tx.execute(
            "INSERT INTO user_progress (user_id, question_id, status, next_review_at, correct_streak, last_reviewed_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![user_id, p.question_id, p.status, p.next_review_at, p.correct_streak, p.last_reviewed_at]
        )?;
    }
    
    // Insert History
    for h in data.history {
        tx.execute(
            "INSERT INTO learning_history (user_id, question_id, timestamp, is_correct) 
             VALUES (?1, ?2, ?3, ?4)",
            params![user_id, h.question_id, h.timestamp, h.is_correct]
        )?;
    }
    
    tx.commit()?;
    Ok(())
}

pub fn save_session(user_id: i64, mode: String, question_id: i64) -> Result<()> {
    let conn = Connection::open(DB_PATH)?;
    conn.execute(
        "INSERT INTO user_sessions (user_id, mode, last_question_id)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(user_id, mode) DO UPDATE SET last_question_id = excluded.last_question_id",
        params![user_id, mode, question_id],
    )?;
    Ok(())
}

pub fn get_session_last_id(user_id: i64, mode: String) -> Result<Option<i64>> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare("SELECT last_question_id FROM user_sessions WHERE user_id = ?1 AND mode = ?2")?;
    let res = stmt.query_row(params![user_id, mode], |row| row.get(0)).ok();
    Ok(res)
}

pub fn insert_questions(questions: Vec<Question>) -> Result<usize> {
    let mut conn = Connection::open(DB_PATH)?;
    let tx = conn.transaction()?;
    
    let mut count = 0;
    for q in questions {
        let opts_json = serde_json::to_string(&q.options).unwrap_or("[]".to_string());
        let ans_json = serde_json::to_string(&q.correct_answer).unwrap_or("[]".to_string());
        
        // INSERT OR IGNORE を使用して、既に同じ question_text がある場合はスキップする
        let _ = tx.execute(
            "INSERT OR IGNORE INTO questions (question_text, options, correct_answer, explanation, source_file, category, exam_year)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                q.question_text, 
                opts_json, 
                ans_json, 
                q.explanation, 
                q.source_file, 
                q.category,
                q.exam_year
            ]
        )?;
        
        // Affected rows check for count (approximate as unique index is on question_text)
        count += 1;
    }
    
    tx.commit()?;
    Ok(count)
}

pub fn update_question(id: i64, question_text: String, options: Vec<String>, correct_answer: Vec<String>, explanation: String) -> Result<()> {
    let conn = Connection::open(DB_PATH)?;
    let opts_json = serde_json::to_string(&options).unwrap_or("[]".to_string());
    let ans_json = serde_json::to_string(&correct_answer).unwrap_or("[]".to_string());
    
    conn.execute(
        "UPDATE questions SET question_text = ?1, options = ?2, correct_answer = ?3, explanation = ?4 WHERE id = ?5",
        params![question_text, opts_json, ans_json, explanation, id],
    )?;
    Ok(())
}

pub fn get_all_questions_admin() -> Result<Vec<Question>> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare(
        "SELECT id, question_text, options, correct_answer, explanation, source_file, category, exam_year FROM questions"
    )?;
    let q_iter = stmt.query_map([], |row| {
        let options_json: String = row.get(2)?;
        let options: Vec<String> = serde_json::from_str(&options_json).unwrap_or_default();
        let correct_answer_raw: String = row.get(3)?;
        let correct_answer: Vec<String> = if correct_answer_raw.starts_with('[') {
            serde_json::from_str(&correct_answer_raw).unwrap_or_else(|_| vec![correct_answer_raw])
        } else {
            vec![correct_answer_raw]
        };

        Ok(Question {
            id: Some(row.get(0)?),
            question_text: row.get(1)?,
            options,
            correct_answer,
            explanation: row.get(4).unwrap_or_default(),
            source_file: row.get::<_, Option<String>>(5).ok().flatten().unwrap_or_default(),
            category: row.get(6).ok().flatten(),
            exam_year: row.get(7).ok().flatten(),
            status: "new".to_string(),
            next_review_at: None,
            correct_streak: 0,
            last_reviewed_at: None,
        })
    })?;
    let mut vec = Vec::new();
    for q in q_iter { vec.push(q?); }
    Ok(vec)
}

pub fn cleanup_similar_questions() -> Result<usize> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare("SELECT id, question_text FROM questions ORDER BY id ASC")?;
    
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut all_questions = Vec::new();
    for r in rows {
        all_questions.push(r?);
    }

    let mut to_delete = Vec::new();
    let mut seen_normalized = std::collections::HashMap::new();

    for (id, text) in all_questions {
        // Normalize: remove whitespace and common Japanese punctuation
        let normalized: String = text.chars()
            .filter(|c| !c.is_whitespace() && !matches!(*c, '。'|'、'|'？'|'！'|'.'|','|'?'|'!'|'・'|'「'|'」'|'（'|'）'|'('|')'))
            .collect();

        if let Some(&original_id) = seen_normalized.get(&normalized) {
            // Found a duplicate!
            to_delete.push(id);
        } else {
            seen_normalized.insert(normalized, id);
        }
    }

    let deleted_count = to_delete.len();
    if !to_delete.is_empty() {
        let mut conn = Connection::open(DB_PATH)?;
        let tx = conn.transaction()?;
        for id in to_delete {
            tx.execute("DELETE FROM questions WHERE id = ?1", params![id])?;
        }
        tx.commit()?;
    }

    Ok(deleted_count)
}

pub fn export_questions_to_json() -> Result<String> {
    let questions = get_all_questions_simple()?;
    Ok(serde_json::to_string(&questions).unwrap_or_default())
}

fn get_all_questions_simple() -> Result<Vec<Question>> {
    let conn = Connection::open(DB_PATH)?;
    let mut stmt = conn.prepare(
        "SELECT id, question_text, options, correct_answer, explanation, source_file, category, exam_year FROM questions"
    )?;
    let q_iter = stmt.query_map([], |row| {
        let options_json: String = row.get(2)?;
        let options: Vec<String> = serde_json::from_str(&options_json).unwrap_or_default();
        let correct_answer_raw: String = row.get(3)?;
        let correct_answer: Vec<String> = if correct_answer_raw.starts_with('[') {
            serde_json::from_str(&correct_answer_raw).unwrap_or_else(|_| vec![correct_answer_raw])
        } else {
            vec![correct_answer_raw]
        };

        Ok(Question {
            id: row.get(0)?,
            question_text: row.get(1)?,
            options,
            correct_answer,
            explanation: row.get(4)?,
            source_file: row.get(5)?,
            category: row.get(6)?,
            exam_year: row.get(7)?,
            status: "new".to_string(), // Reset status for fresh import
            next_review_at: None,
            correct_streak: 0,
            last_reviewed_at: None,
        })
    })?;
    let mut vec = Vec::new();
    for q in q_iter { vec.push(q?); }
    Ok(vec)
}

pub fn import_questions_from_json(json_data: String) -> Result<usize> {
    let questions: Vec<Question> = serde_json::from_str(&json_data).map_err(|_| rusqlite::Error::InvalidQuery)?;
    insert_questions(questions)
}

// デバッグ用：ダミーデータの投入
pub fn seed_dummy_data() -> Result<()> {
    let conn = Connection::open(DB_PATH)?;

    // データが空の場合のみ追加
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM questions", [], |row| row.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let dummy_questions = vec![
        (
            "社会福祉士及び介護福祉士法における「信用失墜行為の禁止」の規定に関する記述として、適切なものを選択してください。",
            vec!["社会福祉士は、その業務を行うに当たって、信用を傷つけるような行為をしてはならない。", "社会福祉士は、業務時間外であれば、どのような行為も許される。", "信用失墜行為を行った場合でも、罰則規定はない。", "社会福祉士会に入会していなければ、この規定は適用されない。", "介護福祉士には適用されない。"],
            "社会福祉士は、その業務を行うに当たって、信用を傷つけるような行為をしてはならない。",
            "社会福祉士及び介護福祉士法 第四十五条に規定されています。"
        ),
        (
            "日本の社会保障制度給付費の中で、最も割合が高いものはどれですか。",
            vec!["医療", "年金", "福祉その他", "介護", "生活保護"],
            "年金",
            "社会保障給付費の中で年金が約半分を占めています。"
        )
    ];

    for (q, opts, ans, exp) in dummy_questions {
        let opts_json = serde_json::to_string(&opts).unwrap();
        let ans_json = serde_json::to_string(&vec![ans.to_string()]).unwrap();
        conn.execute(
            "INSERT INTO questions (question_text, options, correct_answer, explanation, source_file, status, next_review_at, correct_streak, category, exam_year)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '社会福祉士', 'dummy')",
            params![q, opts_json, ans_json, exp, "dummy_data", "new", Utc::now().to_rfc3339(), 0]
        )?;
    }

    Ok(())
}
