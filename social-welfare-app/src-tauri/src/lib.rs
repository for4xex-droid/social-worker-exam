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

use tauri::Emitter;

fn normalize_string(s: String) -> String {
    s.chars()
        .map(|c| match c {
            '０'..='９' => std::char::from_u32((c as u32) - 0xFEE0).unwrap_or(c),
            'Ａ'..='Ｚ' => std::char::from_u32((c as u32) - 0xFEE0).unwrap_or(c),
            'ａ'..='ｚ' => std::char::from_u32((c as u32) - 0xFEE0).unwrap_or(c),
            _ => c,
        })
        .collect()
}

#[tauri::command]
async fn import_pdf_questions(
    app: tauri::AppHandle,
    file_path: String,
    category: Option<String>,
    exam_year: Option<String>,
) -> Result<String, String> {
    // 1. Generate directly from PDF (Inline)
    println!("Processing file: {}", file_path);
    let _ = app.emit("import-status", "Reading PDF and encoding...");

    // 正規化処理
    let cat = category.map(normalize_string);
    let year = exam_year.map(normalize_string);

    // remove quotes if present, though front-end handles it too
    let clean_path = file_path.replace("\"", "");

    let _ = app.emit(
        "import-status",
        "Sending to Gemini AI (Wait up to 2-3 mins)...",
    );
    let mut questions = gemini::generate_quiz_from_pdf(&clean_path).await?;
    println!("Generated {} questions", questions.len());

    // Inject metadata
    for q in &mut questions {
        q.category = cat.clone();
        q.exam_year = year.clone();
    }

    let _ = app.emit(
        "import-status",
        format!("Saving {} questions to database...", questions.len()),
    );
    // 2. Save to DB
    let count = db::insert_questions(questions).map_err(|e| e.to_string())?;

    let _ = app.emit("import-status", "Done!");
    Ok(format!(
        "Successfully generated and saved {} questions!",
        count
    ))
}

#[tauri::command]
async fn test_connection() -> Result<String, String> {
    gemini::test_api_connection().await
}

#[tauri::command]
fn scan_folder_for_pdfs(folder_path: String) -> Result<Vec<String>, String> {
    let clean_path = folder_path.replace("\"", "");
    let dir = std::path::Path::new(&clean_path);

    if !dir.is_dir() {
        return Err("Not a valid directory".to_string());
    }

    let mut pdfs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("pdf") {
                    if let Some(p) = path.to_str() {
                        pdfs.push(p.to_string());
                    }
                }
            }
        }
    }

    Ok(pdfs)
}

#[tauri::command]
fn get_questions() -> Vec<Question> {
    match db::get_questions_due_today() {
        Ok(questions) => questions,
        Err(e) => {
            eprintln!("Error fetching questions: {}", e);
            vec![]
        }
    }
}

#[tauri::command]
fn get_all_questions() -> Vec<Question> {
    match db::get_all_questions() {
        Ok(questions) => questions,
        Err(e) => {
            eprintln!("Error fetching all questions: {}", e);
            vec![]
        }
    }
}

#[tauri::command]
fn get_stats() -> Result<models::LearningStats, String> {
    db::get_learning_stats().map_err(|e| e.to_string())
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
    // Try loading from multiple locations
    dotenv().ok();

    // Debug info
    let cwd = std::env::current_dir().unwrap_or_default();
    println!("Current working directory: {:?}", cwd);
    match std::env::var("GEMINI_API_KEY") {
        Ok(val) => println!("GEMINI_API_KEY found: {}...", &val[..5]),
        Err(e) => println!("GEMINI_API_KEY error: {}", e),
    }

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
            get_all_questions,
            get_stats,
            submit_answer,
            import_pdf_questions,
            test_connection,
            scan_folder_for_pdfs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
