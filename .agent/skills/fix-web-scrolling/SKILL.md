---
name: fix-web-scrolling
description: Protocol for fixing vertical scrolling issues in Expo Web applications (React Native Web).
---

# Web Scrolling Fix Protocol

## Context
Expo Web (React Native Web) often applies default styles that lock the viewport height (`height: 100%`) and hide overflow (`overflow: hidden`) on the `body` and `#root` elements. This mimics a native mobile app but breaks standard web scrolling behavior, causing content to be cut off without scrollbars.

## The Solution Strategy (The "Golden Path")
To enable proper vertical scrolling on the web, a three-part strategy is required:

### 1. The HTML Patch (Post-Build)
You must aggressively patch the generated `dist/index.html` to remove Expo's default reset styles and inject custom overrides.
**Do not rely on `app.json` or `global.css` alone.** The build process often overwrites these.

**Script: `fix_web_scroll.py`**
Run this script *immediately after* `expo export -p web`.
It performs the following:
-   **Removes** the `<style id="expo-reset">` block (which contains `overflow: hidden`).
-   **Injects** `html, body { height: auto !important; min-height: 100% !important; overflow-y: auto !important; }`.
-   **Forces** visual scrollbars via `::-webkit-scrollbar { display: block; }` to prevent browsers from hiding them.

### 2. The React Component Configuration
Standard `flex: 1` layouts often fail to calculate the correct scrollable area on Web.
**For Web Platform Only:**
-   **Disable `flex-1`**: Remove `flex: 1` class from the `ScrollView`.
-   **Fixed Height**: Set a deterministic height (e.g., `height: '75vh'`) instead of `100%`. This forces the browser to recognize the container as a scrollable window smaller than the content.
-   **Explicit Overflow**: specific `style={{ overflowY: 'scroll' }}`.
-   **Default `scrollEnabled`**: Do NOT set `scrollEnabled={false}` hoping to use native scrolling. This applies `overflow: hidden` on Web. Leave it true (default).

**Code Example (`index.tsx`):**
```typescript
<ScrollView
    // Remove flex-1 on web to prevent 100vh locking
    className={Platform.OS === 'web' ? "" : "flex-1"} 
    contentContainerStyle={{ paddingBottom: 100 }}
    // Web: Fixed viewport height + explicit scroll
    style={Platform.OS === 'web' ? { height: '75vh', overflowY: 'scroll' } : undefined}
>
    {/* Content */}
</ScrollView>
```

### 3. The Layout Structure
-   **Avoid `SafeAreaProvider` on Web**: It can inject rigid layout styles. Use a simple `View` or `div` wrapper.
-   **Use `Slot` instead of `Stack`**: If the navigation stack is causing layout issues, use `<Slot />` in the web-specific layout branch in `_layout.tsx`.

## Diagnostic Check
If scrolling fails:
1.  **Check `index.html`**: Does `body` have `overflow: hidden`? (Run the patch script).
2.  **Check ScrollView**: Is `scrollEnabled={false}`? (Remove it).
3.  **Check Height**: Is the container `height: 100%`? (Change to `75vh` or `calc(100vh - 100px)`).

## Related Files
- `app/fix_web_scroll.py` (The patch script)
- `app/dist/index.html` (The target artifact)
