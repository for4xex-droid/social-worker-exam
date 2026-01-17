use anyhow::Result;
use serde_json::json;
use dotenvy::dotenv;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    // 1. Env & Logs
    dotenv().ok();
    init_tracing()?;

    // 2. Global Panic Hook (Logs panics instead of silent crash)
    std::panic::set_hook(Box::new(|info| {
        error!(panic_info = ?info, "🔥 CRITICAL PANIC OCCURRED");
    }));

    info!("🌌 Singularity App Started: {}", env!("CARGO_PKG_NAME"));

    // 3. Run Logic
    if let Err(e) = run().await {
        error!(error = ?e, "💥 Fatal Application Error");
        std::process::exit(1);
    }
    Ok(())
}

async fn run() -> Result<()> {
    // Demo: HTTP Client with Rustls (Safe on Alpine)
    let _client = reqwest::Client::new();
    
    // Demo: JSON Macro (AI loves this)
    let data = json!({ "status": "ready", "vibe": 100 });
    
    info!(data = ?data, "System is operational");
    
    // Keep alive for demo
    // tokio::signal::ctrl_c().await?;
    Ok(())
}

fn init_tracing() -> Result<()> {
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .without_time(); // Cleaner local logs
        
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "info".into());

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt_layer)
        .init();
    Ok(())
}
