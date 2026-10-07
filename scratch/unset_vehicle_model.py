from pymongo import MongoClient

try:
    client = MongoClient("mongodb://localhost:27017")
    db = client["SmartParkingDB"]
    users_col = db["users"]
    
    # Run the $unset operation to remove vehicle_model from all users
    result = users_col.update_many({}, {"$unset": {"vehicle_model": ""}})
    print(f"[OK] Successfully unset vehicle_model in {result.modified_count} user documents.")
except Exception as e:
    print(f"[ERR] Failed to clean up database: {e}")
