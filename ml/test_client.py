import os
import json
import requests
import pandas as pd

API = os.environ.get('PARKING_API', 'http://localhost:5000')
print('Using API:', API)

df = pd.read_csv('data/processed_parking.csv')
# take 10 samples
samples = df.sample(10, random_state=42)

results = []
for _, r in samples.iterrows():
    payload = {
        'hour': int(r['hour']),
        'day_of_week': int(r['day_of_week']),
        'is_weekend': int(r['is_weekend']),
        'Nearby_Traffic_Level': r['Nearby_Traffic_Level'],
        'Weather_Temperature': float(r['Weather_Temperature']),
        'Weather_Precipitation': float(r['Weather_Precipitation']),
        'Proximity_To_Exit': float(r['Proximity_To_Exit']),
        'Spot_Size': r['Spot_Size']
    }
    try:
        resp = requests.post(f"{API}/predict", json=payload, timeout=5)
        resp.raise_for_status()
        results.append(resp.json())
    except Exception as e:
        results.append({'error': str(e)})

print(json.dumps(results, indent=2))
