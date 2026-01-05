use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Question {
    pub id: Option<i64>,
    pub question_text: String,
    pub options: Vec<String>, // JSONとして保存される
    pub correct_answer: String,
    pub explanation: String,
    pub source_file: String,
    pub status: String, // "new", "learning", "mastered"
    pub next_review_at: Option<DateTime<Utc>>,
    pub correct_streak: i32,
    pub last_reviewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnswerSubmission {
    pub question_id: i64,
    pub is_correct: bool,
}
