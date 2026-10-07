import os
import pickle
import pandas as pd
import numpy as np

def main():
    ml_dir = "ml"
    
    # Load scaling and encoding artifacts
    with open(os.path.join(ml_dir, "scaler.pkl"), "rb") as f:
        scaler = pickle.load(f)
    with open(os.path.join(ml_dir, "encoders.pkl"), "rb") as f:
        encoders = pickle.load(f)
    with open(os.path.join(ml_dir, "feature_order.pkl"), "rb") as f:
        feature_order = pickle.load(f)
        
    # Load model
    if os.path.exists(os.path.join(ml_dir, "parking_model.pkl")):
        with open(os.path.join(ml_dir, "parking_model.pkl"), "rb") as f:
            model = pickle.load(f)
        model_type = "sklearn"
    else:
        print("Model file not found!")
        return

    print(f"Loaded {model_type} model.")
    print(f"Feature order: {feature_order}")
    
    # Let's test a few combinations of features:
    # 1. Peak rush hour, weekend=0, traffic=High, temp=38, precip=0.5, close to exit, small size
    # 2. Night, weekend=1, traffic=Low, temp=12, precip=0, far from exit, standard size
    
    test_cases = [
        # Rush hour morning
        {
            "hour": 9,
            "day_of_week": 0, # Monday
            "is_weekend": 0,
            "is_rush_hour": 1,
            "is_night": 0,
            "is_working_hour": 1,
            "Nearby_Traffic_Level": "High",
            "Weather_Temperature": 38.0,
            "Weather_Precipitation": 0.8,
            "Proximity_To_Exit": 5.0,
            "Spot_Size": "Standard"
        },
        # Regular hour afternoon
        {
            "hour": 14,
            "day_of_week": 2, # Wednesday
            "is_weekend": 0,
            "is_rush_hour": 0,
            "is_night": 0,
            "is_working_hour": 1,
            "Nearby_Traffic_Level": "Medium",
            "Weather_Temperature": 25.0,
            "Weather_Precipitation": 0.0,
            "Proximity_To_Exit": 15.0,
            "Spot_Size": "Standard"
        },
        # Off-peak night
        {
            "hour": 23,
            "day_of_week": 5, # Saturday
            "is_weekend": 1,
            "is_rush_hour": 0,
            "is_night": 1,
            "is_working_hour": 0,
            "Nearby_Traffic_Level": "Low",
            "Weather_Temperature": 12.0,
            "Weather_Precipitation": 0.0,
            "Proximity_To_Exit": 25.0,
            "Spot_Size": "Standard"
        }
    ]
    
    for i, data in enumerate(test_cases):
        # Encode
        data_encoded = data.copy()
        for col in ["Nearby_Traffic_Level", "Spot_Size"]:
            if data_encoded[col] in encoders[col].classes_:
                data_encoded[col] = encoders[col].transform([data_encoded[col]])[0]
            else:
                data_encoded[col] = encoders[col].transform([encoders[col].classes_[0]])[0]
                
        # Feature array
        features = [float(data_encoded[col]) for col in feature_order]
        features_df = pd.DataFrame([features], columns=feature_order)
        
        # Scale
        if hasattr(model, "feature_names_in_"):
            expected_cols = [str(c) for c in model.feature_names_in_]
            features_df = features_df[expected_cols]
        features_scaled = scaler.transform(features_df)
        
        # Predict
        prob = model.predict_proba(features_scaled)[:, 1][0]
        pred = model.predict(features_scaled)[0]
        
        print(f"\nTest Case {i+1}: Hour={data['hour']}, Traffic={data['Nearby_Traffic_Level']}, Weather={data['Weather_Temperature']}C")
        print(f"  Scaled input: {features_scaled[0]}")
        print(f"  Prediction: {pred} (0=Occupied, 1=Available)")
        print(f"  Probability of availability: {prob:.4f}")

if __name__ == "__main__":
    main()
