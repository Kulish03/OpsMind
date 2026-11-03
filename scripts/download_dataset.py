import os
import sys
import zipfile
import requests
import pandas as pd

RAW_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "raw")
ZIP_PATH = os.path.join(RAW_DATA_DIR, "online_retail.zip")
EXCEL_PATH = os.path.join(RAW_DATA_DIR, "Online Retail.xlsx")

# UCI Online Retail official repository direct download URL
UCI_URL = "https://archive.ics.uci.edu/static/public/352/online+retail.zip"

def download_and_inspect():
    os.makedirs(RAW_DATA_DIR, exist_ok=True)
    
    # 1. Download if not already present
    if not os.path.exists(EXCEL_PATH):
        if not os.path.exists(ZIP_PATH):
            print(f"[Download] Fetching UCI Online Retail dataset from {UCI_URL}...")
            response = requests.get(UCI_URL, stream=True, timeout=60)
            response.raise_for_status()
            
            with open(ZIP_PATH, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"[Download] Saved archive to: {ZIP_PATH} ({os.path.getsize(ZIP_PATH) / (1024*1024):.2f} MB)")
        
        # 2. Extract
        print(f"[Extract] Extracting archive...")
        with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
            zip_ref.extractall(RAW_DATA_DIR)
        print(f"[Extract] Extracted to: {RAW_DATA_DIR}")
    else:
        print(f"[Cache] Found existing dataset at: {EXCEL_PATH}")

    # 3. Verify Excel File
    if not os.path.exists(EXCEL_PATH):
        # Look for whatever was extracted
        files = os.listdir(RAW_DATA_DIR)
        print(f"[Files in raw dir]: {files}")
        for f in files:
            if f.endswith(".xlsx") or f.endswith(".csv"):
                global target_file
                target_file = os.path.join(RAW_DATA_DIR, f)
                break
    else:
        target_file = EXCEL_PATH

    print(f"\n[Inspect] Loading dataset from: {target_file} ...")
    df = pd.read_excel(target_file)
    
    print("\n" + "="*50)
    print(" UCI ONLINE RETAIL DATASET — INITIAL INSPECTION")
    print("="*50)
    print(f"Total Rows:     {df.shape[0]:,}")
    print(f"Total Columns:  {df.shape[1]}")
    print(f"Memory Usage:   {df.memory_usage(deep=True).sum() / (1024*1024):.2f} MB")
    print("\nColumns & Types:")
    for col, dtype in df.dtypes.items():
        non_null = df[col].count()
        null_count = df[col].isna().sum()
        print(f" - {col:15} | Type: {str(dtype):10} | Non-Null: {non_null:7,} | Missing: {null_count:7,}")

    print("\nFirst 5 Sample Records:")
    print(df.head(5).to_string())
    print("="*50)

if __name__ == "__main__":
    download_and_inspect()
