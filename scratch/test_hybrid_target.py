import pandas as pd
import numpy as np

def main():
    df = pd.read_csv("ml/data/parking.csv")
    timestamps = pd.to_datetime(df["Timestamp"])
    df["hour"] = timestamps.dt.hour
    df["day_of_week"] = timestamps.dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)
    
    df["is_rush_hour"] = (((df["hour"] >= 8) & (df["hour"] <= 10)) | ((df["hour"] >= 17) & (df["hour"] <= 19))) & (df["is_weekend"] == 0)
    df["is_rush_hour"] = df["is_rush_hour"].astype(int)
    
    df["is_night"] = ((df["hour"] >= 19) | (df["hour"] <= 5)).astype(int)
    df["is_working_hour"] = ((df["hour"] >= 9) & (df["hour"] <= 17) & (df["is_weekend"] == 0)).astype(int)
    
    # Let's compute a balanced availability_prob
    availability_prob = 0.50
    availability_prob -= df["is_rush_hour"] * 0.30
    availability_prob -= df["is_working_hour"] * 0.10
    availability_prob += df["is_night"] * 0.25
    availability_prob -= df["is_weekend"] * 0.10
    
    traffic_map = {"Low": 0.10, "Medium": 0.0, "High": -0.25}
    traffic_modifier = df["Nearby_Traffic_Level"].map(traffic_map).fillna(0.0)
    availability_prob += traffic_modifier
    
    prox_min = df["Proximity_To_Exit"].min()
    prox_max = df["Proximity_To_Exit"].max()
    prox_range = (prox_max - prox_min) if (prox_max - prox_min) > 0 else 1.0
    proximity_norm = (df["Proximity_To_Exit"] - prox_min) / prox_range
    availability_prob += (proximity_norm - 0.5) * 0.15
    
    real_availability = df["Occupancy_Status"].apply(
        lambda x: 1 if str(x).strip().lower() in ["vacant", "unoccupied", "1", "available", "free"] else 0
    )
    
    # We want a hybrid target that is highly predictable but also balanced.
    # Let's test a few combinations:
    for w in [0.0, 0.2, 0.4, 0.5, 0.6, 0.8, 1.0]:
        # w is the weight of availability_prob, (1-w) is the weight of real_availability
        hybrid = w * availability_prob + (1 - w) * real_availability
        y = (hybrid >= 0.5).astype(int)
        counts = y.value_counts().to_dict()
        print(f"Weight logical={w:.1f}, Weight real={1-w:.1f} -> Class counts: {counts}")

if __name__ == "__main__":
    main()
