use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use reqwest::Client;
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::path::Path;

pub async fn generate_quiz_from_pdf(
    file_path: &str,
) -> Result<Vec<crate::models::Question>, String> {
    let api_key = env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set in environment".to_string())?;

    // Path check
    let path = Path::new(file_path);
    if !path.exists() {
        return Err(format!("File not found at: {}", file_path));
    }

    // Read and Encode
    let file_content = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let base64_data = general_purpose::STANDARD.encode(&file_content);

    // Prompt design

    // Call Gemini API (Inline Data)
    println!("Sending request to Gemini API...");
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}", api_key);
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to build client: {}", e))?;

    // Prompt design (Balanced for Volume & Quality)
    let prompt = r#"
    あなたは社会福祉士・精神保健福祉士国家試験のカリスマ講師です。
    提供されたPDF資料を徹底的に分析し、本番試験レベルの5択クイズを可能な限り多く作成してください。
    
    【重要要件】
    1. 出力形式: JSON配列のみ。Markdown記法は禁止。
    2. arrayの各要素のオブジェクト構造:
       - "question_text": 問題文（具体的な状況設定や制度の知識を問うもの）
       - "options": 選択肢の配列（文字列5つ）
       - "correct_answer": 正解の選択肢の配列（文字列の配列。通常は1つですが、「2つ選べ」などの場合は複数含めてください）
       - "explanation": 簡潔で分かりやすい解説（2〜3文程度）。
    3. 問題数: **資料の内容が許す限り、最大限多く（目標: 30問〜50問）** 作成してください。
       - 資料が膨大な場合は重要なポイントを優先してください。
    "#;

    let body = json!({
        "contents": [{
            "parts": [
                { "text": prompt },
                {
                    "inline_data": {
                        "mime_type": "application/pdf",
                        "data": base64_data
                    }
                }
            ]
        }],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    });

    println!("DEBUG: URL = {}", url);
    println!(
        "DEBUG: Body size = {} bytes",
        serde_json::to_vec(&body).unwrap_or_default().len()
    );
    println!("DEBUG: Sending request to Gemini API now...");

    let response = client.post(&url).json(&body).send().await;

    println!("DEBUG: Request returned.");

    let response = response.map_err(|e| format!("Request failed: {}", e))?;

    println!("DEBUG: Response Status: {}", response.status());

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        println!("DEBUG: Error Body: {}", text);
        return Err(format!("Gemini API Error: {}", text));
    }

    println!("DEBUG: Success! Parsing JSON...");
    let json_resp: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

    // Extract text from response
    let text = json_resp["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("No text in response")?;

    // Clean up potentially contained markdown blocks (just to be safe)
    let clean_text = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```");

    // Parse extracted JSON
    let questions_raw: Vec<serde_json::Value> = serde_json::from_str(clean_text).map_err(|e| {
        format!(
            "Failed to parse generated JSON content: {} | Raw: {}",
            e, clean_text
        )
    })?;

    // Convert to Model
    let mut result = Vec::new();
    let file_name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    for q in questions_raw {
        let options_val = q["options"].as_array().ok_or("Invalid options format")?;
        let options: Vec<String> = options_val
            .iter()
            .map(|v| v.as_str().unwrap_or("").to_string())
            .collect();

        let correct_answer: Vec<String> = match &q["correct_answer"] {
            Value::Array(arr) => arr
                .iter()
                .map(|v| v.as_str().unwrap_or("").to_string())
                .collect(),
            Value::String(s) => vec![s.clone()],
            _ => vec![],
        };

        result.push(crate::models::Question {
            id: None,
            question_text: q["question_text"].as_str().unwrap_or("").to_string(),
            options,
            correct_answer,
            explanation: q["explanation"].as_str().unwrap_or("").to_string(),
            source_file: file_name.clone(),
            category: None,
            exam_year: None,
            status: "new".to_string(),
            next_review_at: None,
            correct_streak: 0,
            last_reviewed_at: None,
        });
    }

    Ok(result)
}

pub async fn audit_questions(
    questions: Vec<crate::models::Question>,
) -> Result<Vec<crate::models::Question>, String> {
    let api_key = env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set in environment".to_string())?;

    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}", api_key);
    let client = Client::new();

    let questions_json = serde_json::to_string(&questions).unwrap_or_default();

    let prompt = format!(
        r#"
        あなたは社会福祉士国家試験の専門校閲者です。以下の学習用クイズのリストを精査してください。
        
        【校閲のポイント】
        1. 事実誤認、制度の解釈ミス、古い情報の修正（最新の法改正に対応）。
        2. 「2つ選べ」という指示があるのに正解(correct_answer)が1つしかない等の論理矛盾の修正。
        3. 解説文(explanation)をより分かりやすく、かつプロ級の品質にブラッシュアップ。
        4. 選択肢(options)に紛らわしすぎるものや無意味なものがあれば改善。
        
        【出力形式】
        入力と同じ構造のJSON配列（全てのフィールドを維持）のみを出力してください。修正がない場合も、修正なしの状態で全ての要素を返してください。
        
        対象データ:
        {}
        "#,
        questions_json
    );

    let body = json!({
        "contents": [{
            "parts": [{ "text": prompt }]
        }],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Audit failed: {}", resp.status()));
    }

    let json_resp: Value = resp.json().await.map_err(|e| e.to_string())?;
    let text = json_resp["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or("No text")?;

    let corrected: Vec<crate::models::Question> = serde_json::from_str(text)
        .map_err(|e| format!("Failed to parse audit result: {} | Raw: {}", e, text))?;

    Ok(corrected)
}

pub async fn test_api_connection() -> Result<String, String> {
    let api_key = env::var("GEMINI_API_KEY").map_err(|_| "GEMINI_API_KEY not set".to_string())?;

    // Use the confirmed working model
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}", api_key);
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let body = json!({
        "contents": [{
            "parts": [{ "text": "Hello, write 'OK' if you can read this." }]
        }]
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Test Failed: {} | Body: {}", status, text));
    }

    let json: Value = resp.json().await.map_err(|e| e.to_string())?;
    let text = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("No text")
        .to_string();
    Ok(text)
}
