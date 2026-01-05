use anyhow::{anyhow, Result};
use reqwest::multipart;
use reqwest::Client;
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::path::Path; // Using anyhow for easier error handling if available, else standard Box<dyn Error> logic or String

// Simulating anyhow locally for brevity if not added, but I'll return Result<T, String> for Tauri compatibility.

pub async fn upload_file_to_gemini(file_path: &str) -> Result<String, String> {
    let api_key = env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set in environment".to_string())?;
    let path = Path::new(file_path);
    let file_name = path
        .file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .to_string();
    let file_content = fs::read(path).map_err(|e| e.to_string())?;

    // MIME inference (simplified)
    let mime_type = if file_path.ends_with(".pdf") {
        "application/pdf"
    } else {
        "text/plain"
    };

    let client = Client::new();

    // 1. Upload File (Resumable upload specific for larger files, but for simplicty trying the media upload endpoint if small enough,
    // actually Gemini File API requires specific flow: https://ai.google.dev/api/files)
    // The correct endpoint for files API is POST https://generativelanguage.googleapis.com/upload/v1beta/files

    // Start upload
    let url = format!(
        "https://generativelanguage.googleapis.com/upload/v1beta/files?key={}",
        api_key
    );

    // Construct simplified metadata and body
    // Note: Rust reqwest multipart is good.
    // The docs say:
    // POST .../upload/v1beta/files?key=...
    // Headers: X-Goog-Upload-Protocol: multipart

    // However, the standard `multipart` approach in reqwest sends a multipart/form-data.
    // Google's upload API often accepts a JSON metadata part and a media part.
    // For simplicity, let's stick to the official guide's "media" upload or just checking if we can send the bytes directly with correct headers.

    // Let's try the standard `multipart/related` or `multipart/form-data` if supported, OR usage of the `upload` endpoint.
    // Actually, for simple usage:
    // 1. Initial request to get upload URL...
    // Let's use the simplest: "Multipart upload"

    let metadata = json!({
        "file": {
            "display_name": file_name
        }
    })
    .to_string();

    let form = multipart::Form::new()
        .part(
            "metadata",
            multipart::Part::text(metadata)
                .mime_str("application/json")
                .unwrap(),
        )
        .part(
            "file",
            multipart::Part::bytes(file_content)
                .file_name(file_name)
                .mime_str(mime_type)
                .unwrap(),
        );

    let response = client
        .post(&url)
        .header("X-Goog-Upload-Protocol", "multipart")
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Upload failed: {}", text));
    }

    let json_resp: Value = response.json().await.map_err(|e| e.to_string())?;
    let file_uri = json_resp["file"]["uri"]
        .as_str()
        .ok_or("No URI in response")?
        .to_string();

    Ok(file_uri)
}

pub async fn generate_quiz_from_file(
    file_uri: &str,
) -> Result<Vec<crate::models::Question>, String> {
    let api_key = env::var("GEMINI_API_KEY").map_err(|_| "GEMINI_API_KEY not set".to_string())?;
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={}", api_key);

    let client = Client::new();

    // Prompt design for JSON output
    let prompt = r#"
    あなたは社会福祉士国家試験のカリスマ講師です。
    提供された資料に基づき、試験に出題されそうな重要なポイントを抽出し、5択式の過去問風クイズを作成してください。
    
    【要件】
    1. 出力は純粋なJSON配列のみ。Markdownのコードブロック(```json ... ```)は絶対に含まないこと。
    2. キー名の構成:
       - question_text: 問題文
       - options: 選択肢の配列(["...", ...])
       - correct_answer: 正解の選択肢の文字列（optionsに含まれるものと完全一致させること）
       - explanation: 詳細な解説
    3. 難易度は本番試験レベル。
    4. 少なくとも5問作成してください。
    "#;

    let body = json!({
        "contents": [{
            "parts": [
                { "text": prompt },
                {
                    "file_data": {
                        "mime_type": "application/pdf",
                        "file_uri": file_uri
                    }
                }
            ]
        }],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    });

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Generation failed: {}", text));
    }

    let json_resp: Value = response.json().await.map_err(|e| e.to_string())?;

    // Extract text from response
    // candidates[0].content.parts[0].text
    let text = json_resp["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("No text in response")?;

    // Clean up potential markdown if the model ignored instructions (just in case)
    let clean_text = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```");

    // Parse JSON
    let questions_raw: Vec<serde_json::Value> = serde_json::from_str(clean_text)
        .map_err(|e| format!("Failed to parse JSON: {} | Text: {}", e, clean_text))?;

    // Convert to internal Model
    let mut result = Vec::new();
    for q in questions_raw {
        let options_val = q["options"].as_array().ok_or("Invalid options format")?;
        let options: Vec<String> = options_val
            .iter()
            .map(|v| v.as_str().unwrap_or("").to_string())
            .collect();

        result.push(crate::models::Question {
            id: None, // DB insert時に採番
            question_text: q["question_text"].as_str().unwrap_or("").to_string(),
            options,
            correct_answer: q["correct_answer"].as_str().unwrap_or("").to_string(),
            explanation: q["explanation"].as_str().unwrap_or("").to_string(),
            source_file: "Imported PDF".to_string(), // 後でファイル名を渡すように修正可
            status: "new".to_string(),
            next_review_at: None, // NULL will be handled as "New"
            correct_streak: 0,
            last_reviewed_at: None,
        });
    }

    Ok(result)
}
