import requests, json
API='http://127.0.0.1:5000'
print('GET / ->', requests.get(API).text)
print('GET /meta ->', json.dumps(requests.get(f'{API}/meta').json(), indent=2))
payload={'hour':12,'day_of_week':2,'is_weekend':0,'Nearby_Traffic_Level':'Low','Weather_Temperature':22.0,'Weather_Precipitation':0,'Proximity_To_Exit':5,'Spot_Size':'Standard'}
r = requests.post(f'{API}/predict', json=payload, timeout=10)
print('POST /predict ->', r.status_code, r.json())
