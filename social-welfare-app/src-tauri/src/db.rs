use crate::models::{AnswerSubmission, Question};
use chrono::{DateTime, Duration, Utc};
use rusqlite::{params, Connection, Result};
use serde_json;

const DB_PATH: &str = "social_welfare.db";

pub fn init_db() -> Result<()> {
    let conn = Connection::open(DB_PATH)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY,
            question_text TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            explanation TEXT,
            source_file TEXT,
            status TEXT DEFAULT 'new',
            next_review_at TEXT,
            correct_streak INTEGER DEFAULT 0,
            last_reviewed_at TEXT
        )",
        [],
    )?;

    Ok(())
}

pub fn get_questions_due_today() -> Result<Vec<Question>> {
    let conn = Connection::open(DB_PATH)?;
    let now = Utc::now();

    // next_review_at が現在時刻以前、または NULL (新規) の問題を取得
    // status が 'mastered' 以外のもの
    let mut stmt = conn.prepare(
        "SELECT id, question_text, options, correct_answer, explanation, source_file, status, next_review_at, correct_streak, last_reviewed_at 
         FROM questions 
         WHERE status != 'mastered' 
         AND (next_review_at IS NULL OR next_review_at <= ?1)
         ORDER BY next_review_at ASC
         LIMIT 20"
    )?;

    let question_iter = stmt.query_map(params![now.to_rfc3339()], |row| {
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

        Ok(Question {
            id: row.get(0)?,
            question_text: row.get(1)?,
            options,
            correct_answer: row.get(3)?,
            explanation: row.get(4)?,
            source_file: row.get(5)?,
            status: row.get(6)?,
            next_review_at,
            correct_streak: row.get(8)?,
            last_reviewed_at,
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

    // 現在の状態を取得
    let mut stmt = conn.prepare("SELECT correct_streak FROM questions WHERE id = ?1")?;
    let current_streak: i32 = stmt.query_row(params![submission.question_id], |row| row.get(0))?;

    let (new_streak, next_review_days) = if submission.is_correct {
        let new_streak = current_streak + 1;
        // 忘却曲線ロジック: 2の(streak)乗 * 1日後 (例: 1, 2, 4, 8日後...)
        // ただし最大間隔などは調整可能にする
        let days = 2_i64.pow(new_streak.min(10) as u32);
        (new_streak, days)
    } else {
        // 不正解ならリセット (即復習)
        (0, 0)
    };

    let next_review_at = if next_review_days == 0 {
        now // 即時復習
    } else {
        now + Duration::days(next_review_days)
    };

    let status = if new_streak >= 5 {
        "mastered"
    } else {
        "learning"
    };

    conn.execute(
        "UPDATE questions 
         SET status = ?1, 
             correct_streak = ?2, 
             next_review_at = ?3, 
             last_reviewed_at = ?4 
         WHERE id = ?5",
        params![
            status,
            new_streak,
            next_review_at.to_rfc3339(),
            now.to_rfc3339(),
            submission.question_id
        ],
    )?;

    Ok(())
}

pub fn insert_questions(questions: Vec<Question>) -> Result<usize> {
    let mut conn = Connection::open(DB_PATH)?;
    let tx = conn.transaction()?;
    
    let mut count = 0;
    for q in questions {
        let opts_json = serde_json::to_string(&q.options).unwrap_or("[]".to_string());
        
        tx.execute(
            "INSERT INTO questions (question_text, options, correct_answer, explanation, source_file, status, next_review_at, correct_streak)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                q.question_text, 
                opts_json, 
                q.correct_answer, 
                q.explanation, 
                q.source_file, 
                "new", 
                Utc::now().to_rfc3339(), // 即時学習可能にするため現在時刻
                0
            ]
        )?;
        count += 1;
    }
    
    tx.commit()?;
    Ok(count)
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
        conn.execute(
            "INSERT INTO questions (question_text, options, correct_answer, explanation, source_file, status, next_review_at, correct_streak)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![q, opts_json, ans, exp, "dummy_data", "new", Utc::now().to_rfc3339(), 0]
        )?;
    }

    Ok(())
}
