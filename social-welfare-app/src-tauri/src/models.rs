use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Question {
    pub id: Option<i64>,
    pub question_text: String,
    pub options: Vec<String>, // JSONとして保存される
    pub correct_answer: String,
    pub explanation: String,
    pub source_file: String,
    // New fields for categorization
    pub category: Option<String>,  // e.g. "社会福祉士"
    pub exam_year: Option<String>, // e.g. "令和4年度"
    pub status: String,            // "new", "learning", "mastered"
    pub next_review_at: Option<DateTime<Utc>>,
    pub correct_streak: i32,
    pub last_reviewed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnswerSubmission {
    pub question_id: i64,
    pub user_id: i64,
    pub is_correct: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryStats {
    pub category: String,
    pub total: i32,
    pub mastered: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LearningStats {
    pub total_questions: i32,
    pub mastered_questions: i32,
    pub category_stats: Vec<CategoryStats>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct UserSyncData {
    pub progress: Vec<UserProgressRow>,
    pub history: Vec<LearningHistoryRow>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProgressRow {
    pub question_id: i64,
    pub status: String,
    pub next_review_at: Option<String>,
    pub correct_streak: i32,
    pub last_reviewed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LearningHistoryRow {
    pub question_id: i64,
    pub timestamp: String,
    pub is_correct: bool,
}
