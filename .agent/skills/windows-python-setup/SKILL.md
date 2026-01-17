---
name: Windows Python Setup
description: Use `py` command instead of `python` on Windows when Python version issues occur.
---

# Windows Python Setup

## Problem
On Windows, the `python` command may not work correctly due to:
- Multiple Python versions installed
- PATH configuration issues
- Windows Store Python alias conflicts

## Solution
Use the **`py` launcher** instead of `python`:

### Running Scripts
```powershell
# Instead of:
python script.py

# Use:
py script.py
```

### Installing Packages
```powershell
# Instead of:
pip install package_name

# Use:
py -m pip install package_name
```

### Specifying Python Version
```powershell
# Use Python 3.11 specifically
py -3.11 script.py

# Use Python 3.10
py -3.10 script.py
```

## Why This Works
The `py` launcher (Python Launcher for Windows) is installed with Python on Windows and:
1. Automatically finds the correct Python installation
2. Resolves version conflicts
3. Bypasses Windows Store alias issues

## Quick Reference
| Old Command | New Command |
|-------------|-------------|
| `python script.py` | `py script.py` |
| `python -m pip install X` | `py -m pip install X` |
| `pip install X` | `py -m pip install X` |
| `python --version` | `py --version` |

## Note
Always use `py` when running Python scripts in this project on Windows.
