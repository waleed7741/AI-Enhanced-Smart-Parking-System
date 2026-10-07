import urllib.request
import json

def test_predict(payload, label):
    url = "http://localhost:5000/predict"
    req = urllib.request.Request(url, method="POST")
    req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req, data=json.dumps(payload).encode("utf-8")) as response:
            res_body = response.read().decode("utf-8")
            data = json.loads(res_body)
            print(f"[{label}]")
            print(f"  Payload: {payload}")
            print(f"  Response: {data}")
    except Exception as e:
        print(f"[{label}] Error: {e}")

def main():
    print("Testing running backend /predict endpoint with location-aware model:")
    
    # Blue Area vs Centaurus during rush hour (Monday 9 AM)
    test_predict({"hour": 9, "day_of_week": 0, "parking_id": 1, "slot_id": 1}, "Centaurus - Monday 9am (Rush)")
    test_predict({"hour": 9, "day_of_week": 0, "parking_id": 8, "slot_id": 1}, "Blue Area - Monday 9am (Rush)")
    
    # Blue Area vs Centaurus on weekend (Sunday 2 PM)
    test_predict({"hour": 14, "day_of_week": 6, "parking_id": 1, "slot_id": 5}, "Centaurus - Sunday 2pm")
    test_predict({"hour": 14, "day_of_week": 6, "parking_id": 8, "slot_id": 5}, "Blue Area - Sunday 2pm")
    
    # Nighttime (Monday 2 AM)
    test_predict({"hour": 2, "day_of_week": 0, "parking_id": 1, "slot_id": 10}, "Centaurus - Monday 2am (Night)")
    test_predict({"hour": 2, "day_of_week": 0, "parking_id": 8, "slot_id": 10}, "Blue Area - Monday 2am (Night)")

if __name__ == "__main__":
    main()
