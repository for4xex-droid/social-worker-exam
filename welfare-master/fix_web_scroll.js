const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, 'app', 'dist', 'index.html');

function main() {
    if (!fs.existsSync(INDEX_PATH)) {
        console.error(`Index file not found at ${INDEX_PATH}`);
        // If dist not found, maybe export wasn't run or failed.
        // We exit gently to avoid breaking pipeline if just testing.
        process.exit(1);
    }

    console.log(`Patching ${INDEX_PATH}...`);
    let html = fs.readFileSync(INDEX_PATH, 'utf-8');

    // 1. Remove standard expo reset if present
    const resetRegex = /<style id="expo-reset">[\s\S]*?<\/style>/;
    if (resetRegex.test(html)) {
        html = html.replace(resetRegex, '');
        console.log("  Removed expo-reset style.");
    }

    // 2. Force scrolling styles
    // We make sure body handles overflow, and root expands.
    const styles = `
    <style>
    html, body {
        height: auto !important;
        min-height: 100% !important;
        overflow-y: auto !important; 
        overscroll-behavior-y: none;
    }
    #root {
        height: auto !important;
        min-height: 100%;
        overflow: visible;
        display: flex;
        flex-direction: column;
    }
    /* Hide scrollbars for cleaner feel but keep functionality */
    ::-webkit-scrollbar {
        width: 8px;
    }
    ::-webkit-scrollbar-thumb {
        background: #ccc; 
        border-radius: 4px;
    }
    </style>
    `;

    html = html.replace('</head>', styles + '</head>');

    fs.writeFileSync(INDEX_PATH, html);
    console.log("  Injected custom scroll styles.");
    console.log("Done.");
}

main();
