import requests
import json
import sys

def run_tests():
    api_base = "http://127.0.0.1:5000"
    
    print("[1/4] Fetching all parking locations to check for hourlyRate...")
    try:
        response = requests.get(f"{api_base}/api/parking")
        if response.status_code != 200:
            print(f"[FAIL] Fetching parking failed: {response.status_code}")
            sys.exit(1)
        
        parking_list = response.json()
        print(f"[OK] Fetched {len(parking_list)} parking spots successfully.")
        
        # Verify first lot has hourlyRate
        first_lot = parking_list[0]
        if "hourlyRate" not in first_lot:
            print("[FAIL] 'hourlyRate' field is missing from parking lot serialization!")
            sys.exit(1)
        
        print(f"[OK] Found hourlyRate: {first_lot['hourlyRate']} (Price: {first_lot['price']}) in Centaurus Mall.")
        
    except Exception as e:
        print(f"[FAIL] Connection error: {e}")
        sys.exit(1)

    print("\n[2/4] Updating parking rate for Centaurus Mall (ID 1) to 125 PKR...")
    try:
        rate_payload = {"hourlyRate": 125}
        response = requests.put(f"{api_base}/api/parking/1/rate", json=rate_payload)
        
        if response.status_code != 200:
            print(f"[FAIL] PUT rate endpoint failed: {response.status_code} - {response.text}")
            sys.exit(1)
            
        data = response.json()
        if not data.get("success") or data.get("hourlyRate") != 125:
            print(f"[FAIL] Response schema mismatch: {data}")
            sys.exit(1)
            
        print("[OK] PUT rate endpoint successfully responded with success status and rate update confirmation.")
        
    except Exception as e:
        print(f"[FAIL] Error updating rate: {e}")
        sys.exit(1)

    print("\n[3/4] Fetching Centaurus Mall by ID to verify MongoDB persistence...")
    try:
        response = requests.get(f"{api_base}/api/parking/1")
        if response.status_code != 200:
            print(f"[FAIL] Fetching parking by ID failed: {response.status_code}")
            sys.exit(1)
            
        lot = response.json()
        if lot.get("hourlyRate") != 125 or lot.get("price") != 125:
            print(f"[FAIL] Mongodb rate desync: hourlyRate={lot.get('hourlyRate')}, price={lot.get('price')} (Expected both to be 125)")
            sys.exit(1)
            
        print(f"[OK] MongoDB verified: Centaurus Mall hourlyRate and price are synchronized at {lot.get('hourlyRate')} PKR.")
        
    except Exception as e:
        print(f"[FAIL] Error fetching lot details: {e}")
        sys.exit(1)

    print("\n[4/4] Creating a mock booking on Centaurus Mall to verify dynamic location cost calculation...")
    try:
        booking_payload = {
            "parking_id": 1,
            "user_name": "Test User",
            "vehicle_number": "TX-4567",
            "duration_hours": 3,
            # We don't send amount, forcing the backend to compute price dynamically
        }
        
        response = requests.post(f"{api_base}/api/book", json=booking_payload)
        if response.status_code != 200:
            print(f"[FAIL] Creating booking failed: {response.status_code} - {response.text}")
            sys.exit(1)
            
        booking_res = response.json()
        # Cost should be 125 * 3 = 375 PKR
        expected_cost = 375
        actual_cost = booking_res.get("total_cost")
        
        if actual_cost != expected_cost:
            print(f"[FAIL] Billing engine cost mismatch: Calculated PKR {actual_cost}, expected PKR {expected_cost}")
            sys.exit(1)
            
        print(f"[OK] Booking success! Dyn Pricing verified: 3 hours @ 125 PKR/hour = {actual_cost} PKR.")
        
    except Exception as e:
        print(f"[FAIL] Error in booking test: {e}")
        sys.exit(1)

    print("\n[SUCCESS] All Location-Specific Pricing backend tests passed flawlessly!")

if __name__ == "__main__":
    run_tests()
