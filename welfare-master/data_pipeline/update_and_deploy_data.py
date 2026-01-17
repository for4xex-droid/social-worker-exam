import subprocess
import sys
import os


def run_script(script_name):
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    if not os.path.exists(script_path):
        print(f"Error: Script not found at {script_path}")
        return False

    print(f"\n>>> Running {script_name}...")
    try:
        # Run the script and wait for it to finish
        result = subprocess.run([sys.executable, script_path], check=True)
        print(f">>> {script_name} completed successfully.")
        return True
    except subprocess.CalledProcessError as e:
        print(f">>> Error running {script_name}: {e}")
        return False


def main():
    print("=== Starting Data Update & Deployment Process ===")

    # 1. Clean Data (Remove random characters, page numbers, etc.)
    if not run_script("clean_data_noise_v2.py"):
        print("Aborting due to cleaning error.")
        return

    # 2. Deploy Assets (Distribute to Native/Web folders)
    if not run_script("update_native_assets.py"):
        print("Aborting due to deployment error.")
        return

    print("\n=== Data Update Complete ===")
    print("Next Steps:")
    print("1. Web: Reload the browser page.")
    print("2. App: Restart the app or reload via Expo menu.")
    print("============================")


if __name__ == "__main__":
    main()
