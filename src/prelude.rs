//! The Singularity Prelude.
//! Importing this gives you Superpowers.

// Error Handling
pub use anyhow::{Result, Context as _, bail, ensure};
pub use thiserror::Error;

// Async & Logs
pub use tracing::{info, error, warn, debug, instrument};

// Data & JSON (Included json! macro for AI speed)
pub use serde::{Serialize, Deserialize};
pub use serde_json::json;
pub use validator::Validate;

// Generic Type Wrapper
pub struct W<T>(pub T);
