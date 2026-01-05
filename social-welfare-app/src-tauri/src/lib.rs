mod db;
mod gemini;
mod models;

use dotenv::dotenv;
use models::Question;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn import_pdf_questions(file_path: String) -> Result<String, String> {
    // 1. Upload
    let uri = gemini::upload_file_to_gemini(&file_path).await?;
    println!("File uploaded: {}", uri);

    // 2. Generate
    let questions = gemini::generate_quiz_from_file(&uri).await?;
    println!("Generated {} questions", questions.len());

    // 3. Save to DB
    let count = db::insert_questions(questions).map_err(|e| e.to_string())?;

    Ok(format!(
        "Successfully generated and saved {} questions!",
        count
    ))
}

#[tauri::command]
fn get_questions() -> Vec<Question> {
    match db::get_questions_due_today() {
        Ok(questions) => questions,
        Err(e) => {
            eprintln!("Failed to get questions: {}", e);
            Vec::new()
        }
    }
}

#[tauri::command]
fn submit_answer(id: i64, is_correct: bool) -> Result<(), String> {
    let submission = models::AnswerSubmission {
        question_id: id,
        is_correct,
    };
    db::register_result(submission).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();

    // DB初期化
    if let Err(e) = db::init_db() {
        eprintln!("Database initialization failed: {}", e);
    }
    // ダミーデータ注入（開発用）
    let _ = db::seed_dummy_data();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_questions,
            submit_answer,
            import_pdf_questions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
