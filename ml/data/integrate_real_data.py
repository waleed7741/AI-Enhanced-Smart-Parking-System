import os
import pandas as pd
import numpy as np

def main():
    print("[START] Integrating Melbourne Parking Sensor Dataset...")
    
    # 1. Identify & Load
    mel_csv = "on-street-parking-bay-sensors.csv"
    if not os.path.exists(mel_csv):
        print(f"[ERR] File not found: {mel_csv}")
        return
        
    print(f"[OK] Loading Melbourne dataset from {mel_csv}...")
    df_mel = pd.read_csv(mel_csv)
    print(f"Original shape: {df_mel.shape}")
    
    # 2. Feature Extraction
    # Essential columns: Status_Timestamp, Status_Description, and KerbsideID
    # Rename to match what preprocess.py expects: Timestamp and Occupancy_Status
    keep_cols = {
        'Status_Timestamp': 'Timestamp',
        'Status_Description': 'Occupancy_Status',
        'KerbsideID': 'Parking_Spot_ID'
    }
    
    # Ensure they exist in the dataframe
    for col in keep_cols.keys():
        if col not in df_mel.columns:
            print(f"[ERR] Expected column '{col}' is missing from the dataset!")
            return
            
    df = df_mel[list(keep_cols.keys())].rename(columns=keep_cols).copy()
    
    # Normalize Timestamps (cast to timezone-naive datetimes)
    df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
    # Drop rows with invalid timestamps
    df = df.dropna(subset=['Timestamp'])
    df['Timestamp'] = df['Timestamp'].dt.tz_localize(None).dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # Convert 'Present'/'Unoccupied' to compatible Occupancy_Status strings: 'Occupied'/'Vacant'
    # Present -> Occupied (not available)
    # Unoccupied -> Vacant (available)
    status_map = {
        'Present': 'Occupied',
        'Unoccupied': 'Vacant'
    }
    df['Occupancy_Status'] = df['Occupancy_Status'].map(status_map).fillna('Vacant')
    
    # 3. Islamabad Location Aliasing
    locations = [
        'Centaurus Mall Parking',
        'Safa Gold Mall Parking',
        'F-6 Markaz - Super Market Parking',
        'F-7 Markaz - Jinnah Super Parking',
        'F-10 Markaz - Main Commercial Hub',
        'G-9 Markaz - Karachi Company Parking',
        'I-8 Markaz - Commercial Area Parking',
        'Blue Area - Jinnah Avenue Commercial Parking',
        'G-11 Markaz - Commercial Center Parking'
    ]
    
    unique_spots = sorted(df['Parking_Spot_ID'].unique())
    print(f"Detected {len(unique_spots)} unique Melbourne sensor spots.")
    
    spot_to_loc = {spot: locations[i % len(locations)] for i, spot in enumerate(unique_spots)}
    df['Parking_Location'] = df['Parking_Spot_ID'].map(spot_to_loc)
    
    # 4. Safeguard: Generate missing/mock columns explicitly required by preprocess.py
    # Seed for reproducibility
    np.random.seed(42)
    
    # Generate mock variables
    df['Nearby_Traffic_Level'] = np.random.choice(['Low', 'Medium', 'High'], size=len(df), p=[0.4, 0.4, 0.2])
    df['Weather_Temperature'] = 25.0
    df['Weather_Precipitation'] = 0.0
    df['Proximity_To_Exit'] = np.random.uniform(1.0, 30.0, size=len(df))
    df['Spot_Size'] = np.random.choice(['Standard', 'Compact', 'Oversized'], p=[0.7, 0.2, 0.1], size=len(df))
    
    # 5. Overwrite
    target_csv = "parking.csv"
    df.to_csv(target_csv, index=False)
    print(f"[OK] Mapped and saved {len(df)} rows to target '{target_csv}' successfully!")
    print("Columns in updated parking.csv:", list(df.columns))
    print("[SUCCESS] Melbourne dataset integration complete!")

if __name__ == "__main__":
    main()
