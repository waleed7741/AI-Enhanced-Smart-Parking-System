import os
import sys
import random
from datetime import datetime
from pymongo import MongoClient

# MongoDB connection configuration
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "SmartParkingDB"
COLLECTION_NAME = "slots"

def seed_parking_data():
    """
    Seed local MongoDB with exactly 9 real, prominent parking locations in Islamabad.
    Replaces all previous placeholders. Pure ASCII output to prevent Windows console encoding crashes.
    """
    try:
        # Connect to MongoDB
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        
        # Clear existing data in the slots collection
        collection.delete_many({})
        print(f"[INFO] Cleared existing records from {DB_NAME}.{COLLECTION_NAME}")
        
        # Exact list of 9 Islamabad parking locations
        parking_data = [
            {
                'id': 1,
                'name': 'Centaurus Mall Parking',
                'sector': 'Sector F-8, Islamabad',
                'capacity': 1000,
                'available': 450,
                'price': 100,
                'latitude': 33.7077,
                'longitude': 73.0501,
                'status': 'available',
                'total_earnings': 150000.0,
                'occupancy_rate': 55.0,
                'prediction_percentage': 78,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 2,
                'name': 'Safa Gold Mall Parking',
                'sector': 'Sector F-7, Islamabad',
                'capacity': 300,
                'available': 120,
                'price': 80,
                'latitude': 33.7169,
                'longitude': 73.0565,
                'status': 'available',
                'total_earnings': 45000.0,
                'occupancy_rate': 60.0,
                'prediction_percentage': 65,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 3,
                'name': 'F-6 Markaz - Super Market Parking',
                'sector': 'Sector F-6, Islamabad',
                'capacity': 250,
                'available': 85,
                'price': 60,
                'latitude': 33.7297,
                'longitude': 73.0784,
                'status': 'available',
                'total_earnings': 35000.0,
                'occupancy_rate': 66.0,
                'prediction_percentage': 72,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 4,
                'name': 'F-7 Markaz - Jinnah Super Parking',
                'sector': 'Sector F-7, Islamabad',
                'capacity': 350,
                'available': 140,
                'price': 60,
                'latitude': 33.7214,
                'longitude': 73.0583,
                'status': 'available',
                'total_earnings': 55000.0,
                'occupancy_rate': 60.0,
                'prediction_percentage': 70,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 5,
                'name': 'F-10 Markaz - Main Commercial Hub',
                'sector': 'Sector F-10, Islamabad',
                'capacity': 400,
                'available': 185,
                'price': 50,
                'latitude': 33.6972,
                'longitude': 73.0118,
                'status': 'available',
                'total_earnings': 62000.0,
                'occupancy_rate': 53.75,
                'prediction_percentage': 68,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 6,
                'name': 'G-9 Markaz - Karachi Company Parking',
                'sector': 'Sector G-9, Islamabad',
                'capacity': 500,
                'available': 220,
                'price': 40,
                'latitude': 33.6897,
                'longitude': 73.0244,
                'status': 'available',
                'total_earnings': 78000.0,
                'occupancy_rate': 56.0,
                'prediction_percentage': 62,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 7,
                'name': 'I-8 Markaz - Commercial Area Parking',
                'sector': 'Sector I-8, Islamabad',
                'capacity': 300,
                'available': 95,
                'price': 50,
                'latitude': 33.6703,
                'longitude': 73.0742,
                'status': 'limited',
                'total_earnings': 48000.0,
                'occupancy_rate': 68.33,
                'prediction_percentage': 55,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 8,
                'name': 'Blue Area - Jinnah Avenue Commercial Parking',
                'sector': 'Blue Area, Islamabad',
                'capacity': 600,
                'available': 280,
                'price': 50,
                'latitude': 33.7118,
                'longitude': 73.0601,
                'status': 'available',
                'total_earnings': 95000.0,
                'occupancy_rate': 53.33,
                'prediction_percentage': 75,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            },
            {
                'id': 9,
                'name': 'G-11 Markaz - Commercial Center Parking',
                'sector': 'Sector G-11, Islamabad',
                'capacity': 200,
                'available': 75,
                'price': 40,
                'latitude': 33.6685,
                'longitude': 72.9984,
                'status': 'available',
                'total_earnings': 28000.0,
                'occupancy_rate': 62.5,
                'prediction_percentage': 60,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
        ]
        
        # Generate persistent, reproducible slot layouts for each location
        random.seed(42)
        for lot in parking_data:
            lot['hourlyRate'] = lot.get('price', 80)
            capacity = lot['capacity']
            available = lot['available']
            booked_count = max(0, capacity - available)
            
            all_slots = list(range(1, capacity + 1))
            booked_indices = set(random.sample(all_slots, min(booked_count, capacity)))
            
            slot_layouts = []
            for slot_num in range(1, capacity + 1):
                # Mark 10% of slots as EV slots (multiples of 10)
                is_ev = (slot_num % 10 == 0)
                slot_layouts.append({
                    'id': slot_num,
                    'number': f"S-{slot_num}",
                    'isBooked': slot_num in booked_indices,
                    'isEV': is_ev
                })
            lot['slot_layouts'] = slot_layouts
            
            # Re-calculate status cleanly based on availability
            if available == 0:
                lot['status'] = 'full'
            elif available <= 30:
                lot['status'] = 'limited'
            else:
                lot['status'] = 'available'
        
        # Insert records into local MongoDB slots collection
        result = collection.insert_many(parking_data)
        print(f"[OK] Successfully seeded {len(result.inserted_ids)} prominent parking locations into MongoDB!")
        
        # Display sample output
        print("\n[DATA] Sample Parking Lot Info:")
        for lot in parking_data[:2]:
            print(f"- [ID {lot['id']}] {lot['name']} ({lot['sector']})")
            print(f"  Capacity: {lot['capacity']} | Available: {lot['available']} | Price: PKR {lot['price']}")
            print(f"  Coordinates: ({lot['latitude']}, {lot['longitude']})")
            
    except Exception as e:
        print(f"[ERR] Error seeding database: {e}")
        return False
    finally:
        if 'client' in locals():
            client.close()
    return True

if __name__ == "__main__":
    print("[START] Seeding local MongoDB with Islamabad Parking Locations...")
    success = seed_parking_data()
    if success:
        print("\n[SUCCESS] Database refresh complete!")
        sys.exit(0)
    else:
        print("\n[FAIL] Seeding failed!")
        sys.exit(1)
