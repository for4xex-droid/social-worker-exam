import os
import re

DIST_INDEX = "dist/index.html"


def fix_index_html():
    if not os.path.exists(DIST_INDEX):
        print(f"Error: {DIST_INDEX} not found. Run 'expo export -p web' first.")
        return

    print(f"Reading {DIST_INDEX}...")
    with open(DIST_INDEX, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to find expo-reset style block and remove it entirely
    pattern = re.compile(r'<style id="expo-reset">.*?</style>', re.DOTALL)

    if pattern.search(content):
        print("Found expo-reset block. Removing it...")
        content = pattern.sub("<!-- expo-reset removed -->", content)

    # Check if we already injected styles (idempotency)
    if 'id="force-scroll"' in content:
        print("Custom styles already present. Skipping injection.")
    else:
        # Inject custom scroll styles ensuring flexible height AND visible scrollbars
        custom_style = """
        <style id="force-scroll">
          html {
            height: auto !important;
            min-height: 100% !important;
            overflow-y: auto !important;
          }
          body { 
            height: auto !important;
            min-height: 100% !important;
            overflow-y: auto !important;
            margin: 0;
          }
          #root { 
            height: auto !important;
            min-height: 100% !important;
            display: flex; 
            flex-direction: column;
          }
          
          /* Force Scrollbar Visibility ensuring high contrast */
          ::-webkit-scrollbar {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            display: block !important;
          }
          ::-webkit-scrollbar-thumb {
            background-color: #94a3b8; /* Slate-400 */
            border-radius: 7px;
            border: 3px solid #f1f5f9;
          }
          ::-webkit-scrollbar-track {
            background-color: #f1f5f9; /* Slate-100 */
          }
          
          /* Firefox */
          * {
            scrollbar-width: auto !important;
            scrollbar-color: #94a3b8 #f1f5f9 !important;
          }
        </style>
        """
        # Inject before closing head
        content = content.replace("</head>", custom_style + "</head>")

    with open(DIST_INDEX, "w", encoding="utf-8") as f:
        f.write(content)
    print("Success: Patched index.html aggressively with VISIBLE scrollbars.")


if __name__ == "__main__":
    fix_index_html()
