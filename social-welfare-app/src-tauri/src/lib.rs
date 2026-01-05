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
async fn split_pdf_and_import(
    app: tauri::AppHandle,
    file_path: String,
    category: Option<String>,
    exam_year: Option<String>,
) -> Result<String, String> {
    let clean_path = file_path.replace("\"", "");
    let path = std::path::Path::new(&clean_path);
    if !path.exists() {
        return Err("File not found".to_string());
    }

    let _ = app.emit("import-status", "Analyzing PDF structure...");
    let doc =
        lopdf::Document::load(&clean_path).map_err(|e| format!("Failed to load PDF: {}", e))?;
    let total_pages = doc.get_pages().len();
    let pages_per_part = 40;

    let base_name = path.file_stem().unwrap().to_str().unwrap();
    let parent_dir = path.parent().unwrap();

    let mut total_imported = 0;
    let parts_count = (total_pages as f64 / pages_per_part as f64).ceil() as usize;

    for i in 0..parts_count {
        let start_page = (i * pages_per_part) + 1;
        let end_page = std::cmp::min((i + 1) * pages_per_part, total_pages);

        let _ = app.emit(
            "import-status",
            format!(
                "Extracting part {}/{} (Pages {}-{})...",
                i + 1,
                parts_count,
                start_page,
                end_page
            ),
        );

        // Extract pages for this part
        let mut part_doc = lopdf::Document::with_version("1.5");
        let mut pages_dict = lopdf::Dictionary::new();
        pages_dict.set("Type", lopdf::Object::Name(b"Pages".to_vec()));
        pages_dict.set("Kids", lopdf::Object::Array(vec![].into()));
        pages_dict.set("Count", lopdf::Object::Integer(0));
        let pages_obj_id = part_doc.add_object(pages_dict);

        // This is a simplified extraction logic using lopdf
        // For production, a more robust page copy is needed, but we try a basic approach:
        let mut kids = vec![];
        let mut count = 0;

        let page_numbers: Vec<u32> = (start_page as u32..=end_page as u32).collect();
        // Page numbers are 1-based, we use collect_pages to get the actual pages
        let pages = doc.get_pages();
        for &page_num in &page_numbers {
            if let Some(&page_id) = pages.get(&page_num) {
                // Copy the page object and its dependencies (simplified)
                if let Ok(page_object) = doc.get_object(page_id) {
                    let mut cloned_page = page_object.clone();
                    if let Ok(dict) = cloned_page.as_dict_mut() {
                        dict.set("Parent", pages_obj_id);
                    }
                    let new_id = part_doc.add_object(cloned_page);
                    kids.push(lopdf::Object::Reference(new_id));
                    count += 1;
                }
            }
        }

        if let Ok(lopdf::Object::Dictionary(ref mut dict)) = part_doc.get_object_mut(pages_obj_id) {
            dict.set("Kids", kids);
            dict.set("Count", count as i64);
        }

        let mut root_dict = lopdf::Dictionary::new();
        root_dict.set("Type", lopdf::Object::Name(b"Catalog".to_vec()));
        root_dict.set("Pages", lopdf::Object::Reference(pages_obj_id));
        let root_id = part_doc.add_object(root_dict);

        part_doc
            .trailer
            .set("Root", lopdf::Object::Reference(root_id));

        let part_filename = format!("{}_part_{}.pdf", base_name, i + 1);
        let part_path = parent_dir.join(&part_filename);
        part_doc
            .save(&part_path)
            .map_err(|e| format!("Failed to save part: {}", e))?;

        // Import this part
        let _ = app.emit(
            "import-status",
            format!("Importing part {}/{}...", i + 1, parts_count),
        );

        // Call the internal logic of import_pdf_questions
        let questions = gemini::generate_quiz_from_pdf(part_path.to_str().unwrap()).await?;

        // Inject metadata
        let cat = category.as_ref().map(|s| normalize_string(s.clone()));
        let year = exam_year.as_ref().map(|s| normalize_string(s.clone()));

        let mut questions_with_meta = questions;
        for q in &mut questions_with_meta {
            q.category = cat.clone();
            q.exam_year = year.clone();
        }

        let saved_count = db::insert_questions(questions_with_meta).map_err(|e| e.to_string())?;
        total_imported += saved_count;

        // Rate limit delay
        if i < parts_count - 1 {
            let _ = app.emit("import-status", "Waiting 5s for rate limit...");
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    }

    Ok(format!(
        "Total {} questions imported from {} parts.",
        total_imported, parts_count
    ))
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
fn save_session(user_id: i64, mode: String, question_id: i64) -> Result<(), String> {
    db::save_session(user_id, mode, question_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_session_last_id(user_id: i64, mode: String) -> Result<Option<i64>, String> {
    db::get_session_last_id(user_id, mode).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_questions(user_id: i64) -> Vec<Question> {
    match db::get_questions_due_today(user_id) {
        Ok(questions) => questions,
        Err(e) => {
            eprintln!("Error fetching questions: {}", e);
            vec![]
        }
    }
}

#[tauri::command]
fn get_all_questions(user_id: i64) -> Vec<Question> {
    match db::get_all_questions(user_id) {
        Ok(questions) => questions,
        Err(e) => {
            eprintln!("Error fetching all questions: {}", e);
            vec![]
        }
    }
}

#[tauri::command]
fn get_questions_by_category(category: String, user_id: i64) -> Vec<Question> {
    match db::get_questions_by_category(category, user_id) {
        Ok(questions) => questions,
        Err(e) => {
            eprintln!("Error fetching questions by category: {}", e);
            vec![]
        }
    }
}

#[tauri::command]
fn get_stats(user_id: i64) -> Result<models::LearningStats, String> {
    db::get_learning_stats(user_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_wrong_questions(user_id: i64) -> Vec<Question> {
    match db::get_wrong_questions(user_id) {
        Ok(questions) => questions,
        Err(e) => {
            eprintln!("Error fetching wrong questions: {}", e);
            vec![]
        }
    }
}

#[tauri::command]
fn cleanup_duplicates() -> Result<usize, String> {
    db::cleanup_similar_questions().map_err(|e| e.to_string())
}

#[tauri::command]
fn export_questions() -> Result<String, String> {
    db::export_questions_to_json().map_err(|e| e.to_string())
}

#[tauri::command]
fn import_questions(json_data: String) -> Result<usize, String> {
    db::import_questions_from_json(json_data).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_user_data(user_id: i64) -> Result<String, String> {
    db::export_user_data(user_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_user_data(user_id: i64, data: String) -> Result<(), String> {
    db::import_user_data(user_id, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_study_history(user_id: i64) -> Vec<(String, i32)> {
    match db::get_study_history(user_id) {
        Ok(h) => h,
        Err(_) => vec![],
    }
}

#[tauri::command]
fn submit_answer(id: i64, user_id: i64, is_correct: bool) -> Result<(), String> {
    let submission = models::AnswerSubmission {
        question_id: id,
        user_id,
        is_correct,
    };
    db::register_result(submission).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_users() -> Result<Vec<models::User>, String> {
    db::get_users().map_err(|e| e.to_string())
}

#[tauri::command]
fn create_user(name: String) -> Result<i64, String> {
    db::create_user(name).map_err(|e| e.to_string())
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
            scan_folder_for_pdfs,
            get_questions_by_category,
            split_pdf_and_import,
            cleanup_duplicates,
            get_wrong_questions,
            get_stats,
            get_users,
            create_user,
            get_study_history,
            export_user_data,
            import_user_data,
            export_questions,
            import_questions,
            save_session,
            get_session_last_id
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
