import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score

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
    
    # Let's compute a balanced logical availability probability
    availability_prob = 0.50
    availability_prob -= df["is_rush_hour"] * 0.30
    availability_prob -= df["is_working_hour"] * 0.15
    availability_prob += df["is_night"] * 0.25
    availability_prob -= df["is_weekend"] * 0.10
    
    traffic_map = {"Low": 0.15, "Medium": 0.0, "High": -0.25}
    traffic_modifier = df["Nearby_Traffic_Level"].map(traffic_map).fillna(0.0)
    availability_prob += traffic_modifier
    
    prox_min = df["Proximity_To_Exit"].min()
    prox_max = df["Proximity_To_Exit"].max()
    prox_range = (prox_max - prox_min) if (prox_max - prox_min) > 0 else 1.0
    proximity_norm = (df["Proximity_To_Exit"] - prox_min) / prox_range
    availability_prob += (proximity_norm - 0.5) * 0.15
    
    location_multipliers = {
        'Centaurus Mall Parking': -0.15,
        'Safa Gold Mall Parking': -0.05,
        'F-6 Markaz - Super Market Parking': -0.02,
        'F-7 Markaz - Jinnah Super Parking': -0.02,
        'F-10 Markaz - Main Commercial Hub': 0.0,
        'G-9 Markaz - Karachi Company Parking': 0.05,
        'I-8 Markaz - Commercial Area Parking': 0.05,
        'Blue Area - Jinnah Avenue Commercial Parking': -0.10,
        'G-11 Markaz - Commercial Center Parking': 0.10
    }
    location_modifier = df["Parking_Location"].map(location_multipliers).fillna(0.0)
    availability_prob += location_modifier
    
    # We define target availability using median of availability_prob
    median_prob = availability_prob.median()
    df["availability"] = (availability_prob >= median_prob).astype(int)
    
    print("Class counts:", df["availability"].value_counts().to_dict())
    
    features = [
        "Parking_Location",
        "hour",
        "day_of_week",
        "is_weekend",
        "is_rush_hour",
        "is_night",
        "is_working_hour",
        "Nearby_Traffic_Level",
        "Weather_Temperature",
        "Weather_Precipitation",
        "Proximity_To_Exit",
        "Spot_Size"
    ]
    
    X = df[features].copy()
    y = df["availability"].copy()
    
    for col in X.select_dtypes(include=['object']).columns:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    print("Accuracy:", accuracy_score(y_test, y_pred))
    print("F1 Score:", f1_score(y_test, y_pred))

if __name__ == "__main__":
    main()
