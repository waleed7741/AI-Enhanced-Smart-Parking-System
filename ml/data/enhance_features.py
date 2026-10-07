import os
import pandas as pd
import numpy as np

def get_traffic_level(hour):
    if (7 <= hour <= 10) or (16 <= hour <= 19):
        return 'High'
    elif (hour >= 23) or (hour <= 5):
        return 'Low'
    else:
        return 'Medium'

def get_temperature(month):
    # Pakistan seasonal mapping:
    # Summer: May (5), June (6), July (7), August (8) -> ~38°C
    # Winter: November (11), December (12), January (1), February (2) -> ~12°C
    # Spring/Autumn: March (3), April (4), September (9), October (10) -> ~25°C
    if month in [5, 6, 7, 8]:
        return 38.0
    elif month in [11, 12, 1, 2]:
        return 12.0
    else:
        return 25.0

def main():
    print("[START] Executing Logical Feature Engineering script...")
    
    target_csv = "parking.csv"
    if not os.path.exists(target_csv):
        print(f"[ERR] Mapped dataset not found: {target_csv}")
        return
        
    print(f"[OK] Loading mapped dataset from {target_csv}...")
    df = pd.read_csv(target_csv)
    print(f"Dataset shape: {df.shape}")
    
    # Parse Timestamps
    timestamps = pd.to_datetime(df['Timestamp'])
    hours = timestamps.dt.hour
    months = timestamps.dt.month
    
    # 1. Traffic Level Logic
    print("[LOGIC] Injecting traffic level rules based on temporal patterns...")
    df['Nearby_Traffic_Level'] = hours.apply(get_traffic_level)
    
    # 2. Weather Logic
    print("[LOGIC] Injecting seasonal temperatures based on calendar month...")
    df['Weather_Temperature'] = months.apply(get_temperature)
    
    # Weather Precipitation
    df['Weather_Precipitation'] = 0.0
    
    # 3. Spot Desirability consistent mapping based on Parking_Spot_ID
    print("[LOGIC] Assigning exit proximity and spot size using deterministic hashing of Parking_Spot_ID...")
    # Map Proximity_To_Exit consistently: ranges between 1.0 and 30.0
    df['Proximity_To_Exit'] = df['Parking_Spot_ID'].apply(lambda sid: float((int(sid) * 17) % 30 + 1))
    
    # Map Spot_Size consistently: Standard, Compact, Oversized
    sizes = ['Standard', 'Compact', 'Oversized']
    df['Spot_Size'] = df['Parking_Spot_ID'].apply(lambda sid: sizes[int(sid) % len(sizes)])
    
    # Overwrite
    df.to_csv(target_csv, index=False)
    print(f"[OK] Saved logically enhanced dataset back to '{target_csv}' successfully!")
    print("Features summary statistics:")
    print("Nearby_Traffic_Level counts:\n", df['Nearby_Traffic_Level'].value_counts())
    print("Weather_Temperature distribution:\n", df['Weather_Temperature'].value_counts())
    print("Spot_Size counts:\n", df['Spot_Size'].value_counts())
    
    print("[SUCCESS] Feature enhancement completed successfully!")

if __name__ == "__main__":
    main()
