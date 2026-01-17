---
name: enhance-ai-instructor
description: Enhance the AI Instructor chat logic with rule-based responsiveness, emotional intelligence, and extended advice presets without increasing API costs.
---

# Enhance AI Instructor Logic

This skill provides a standardized approach to improving the "AI Instructor" or "Chatbot" component within the application. It focuses on adding "pseudo-intelligence" through robust local logic, making the AI feel more responsive and human-like without relying on expensive external LLM APIs for every interaction.

## Key Features to Implement

1.  **Short Message Filtering ("The Listener")**
    *   Intercept short messages (≤3 chars) or common fillers like "え？" (Example?), "うん" (Yeah), "ありがとう" (Thanks).
    *   Respond with context-aware, natural conversation bridges instead of generic "Not found" errors.
    *   *Goal:* Prevent the user from feeling rejected by the system.

2.  **Context-Aware Advice Presets ("The Mentor")**
    *   Detect user sentiment via simple keyword matching (e.g., "tired", "anxious", "happy", "tips").
    *   Provide tailored advice categories:
        *   **Anxiety/Slump Care:** Encouragement for tough times.
        *   **Praise/Motivation:** High-energy compliments for success.
        *   **Study Techniques:** Actionable tips (Pomodoro, spaced repetition).

3.  **Soft Fallback for Search Failures ("The Guide")**
    *   When a database search yields no results (`results.length === 0`), do not simply say "Not Found".
    *   Suggest alternatives: "Did you mean X?", "Try searching for a shorter term", or offer a different action (e.g., "Want to try a random question instead?").

## implementation_template.tsx

Use the following logic structure when updating `ai-instructor.tsx` or similar components.

```typescript
// ... inside your chat handler function ...

const userText = message.trim();
const lowerText = userText.toLowerCase();

// 1. ADVICE & SENTIMENT LOGIC
const sentimentKeywords = ['advice', 'help', 'tired', 'happy', 'tips', 'anxious'];
if (sentimentKeywords.some(k => lowerText.includes(k))) {
    // Select advice based on keyword category
    // ... logic to pick from detailed advice presets ...
    return;
}

// 2. SHORT CONVERSATION FILTER
if (userText.length <= 3 || ['huh?', 'yes', 'thanks', 'ok'].some(w => lowerText.includes(w))) {
    // Return natural conversational filler
    // ... logic to return "Is everything okay?" or "You're welcome!" ...
    return;
}

// 3. DATABASE SEARCH (RAG-LITE)
try {
    // ... Perform DB search ...
    const results = await db.select(/*...*/).where(/*...*/);

    if (results.length > 0) {
        // Success response
    } else {
        // SOFT FALLBACK
        const response = "I couldn't find that specific term. Try shortening your keyword, or ask me for a 'study tip'!";
        // ... setChatLog(response) ...
    }
} catch (e) {
    // Error handling
}
```

## Maintenance
*   Periodically update the `adviceRaw` arrays in your component to keep content fresh.
*   Monitor user feedback to add new keywords to the sentiment detection logic.
