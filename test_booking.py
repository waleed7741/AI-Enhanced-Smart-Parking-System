#!/usr/bin/env python3
"""
Smart Parking Booking System Test Script
Tests the complete booking flow: Frontend -> Backend -> Database
"""

import requests
import json
import time
from pymongo import MongoClient

# Configuration
API_BASE = "http://localhost:5000"
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "SmartParkingDB"
COLLECTION_NAME = "slots"
BOOKINGS_COLLECTION = "bookings"

def test_database_connection():
    """Test MongoDB connection and show initial state"""
    print("🔗 Testing Database Connection...")
    
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        slots_collection = db[COLLECTION_NAME]
        bookings_collection = db[BOOKINGS_COLLECTION]
        
        # Get initial slot counts
        initial_slots = list(slots_collection.find({}, {'_id': 0}))
        initial_bookings = list(bookings_collection.find({}, {'_id': 0}))
        
        print(f"✅ Connected to MongoDB: {MONGO_URI}")
        print(f"📊 Initial State:")
        print(f"   🚗 Total Parking Lots: {len(initial_slots)}")
        print(f"   📋 Total Bookings: {len(initial_bookings)}")
        
        # Show slot counts for each parking lot
        for slot in initial_slots:
            print(f"   📍 {slot['name']}: {slot['available']}/{slot['capacity']} available")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def test_booking_api():
    """Test the booking API endpoint"""
    print("\n🧪 Testing Booking API...")
    
    # Test booking data
    booking_data = {
        "parking_id": 1,
        "user_name": "Test User",
        "vehicle_number": "TEST-123",
        "duration_hours": 2
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/api/book_slot",
            json=booking_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"📤 API Request: POST {API_BASE}/api/book_slot")
        print(f"📋 Booking Data: {json.dumps(booking_data, indent=2)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Booking Successful!")
            print(f"📋 Response: {json.dumps(result, indent=2)}")
            return result
        else:
            print(f"❌ Booking Failed: HTTP {response.status_code}")
            print(f"📋 Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ API Test Failed: {e}")
        return None

def verify_database_changes():
    """Verify that booking was saved and slot count decreased"""
    print("\n🔍 Verifying Database Changes...")
    
    try:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        slots_collection = db[COLLECTION_NAME]
        bookings_collection = db[BOOKINGS_COLLECTION]
        
        # Check new booking
        latest_booking = bookings_collection.find_one(
            {'user_name': 'Test User'},
            sort=[('booking_time', -1)]
        )
        
        if latest_booking:
            print(f"✅ Booking Found in Database:")
            print(f"   📋 Booking ID: {latest_booking.get('_id')}")
            print(f"   👤 User: {latest_booking.get('user_name')}")
            print(f"   🚗 Vehicle: {latest_booking.get('vehicle_number')}")
            print(f"   📍 Parking: {latest_booking.get('parking_name')}")
            print(f"   💰 Cost: PKR {latest_booking.get('total_cost')}")
            print(f"   ⏰ Duration: {latest_booking.get('duration_hours')} hours")
            print(f"   📅 Time: {latest_booking.get('booking_time')}")
        else:
            print("❌ No booking found in database")
        
        # Check slot count change
        parking_lot = slots_collection.find_one({'id': 1})
        if parking_lot:
            print(f"✅ Slot Count Updated:")
            print(f"   📍 Parking: {parking_lot.get('name')}")
            print(f"   🚗 Available Slots: {parking_lot.get('available')}/{parking_lot.get('capacity')}")
            print(f"   📉 Status: {parking_lot.get('status')}")
        
        # Count total bookings
        total_bookings = bookings_collection.count_documents({})
        print(f"✅ Total Bookings in Database: {total_bookings}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Verification Failed: {e}")
        return False

def test_frontend_compatibility():
    """Test that frontend can communicate with backend"""
    print("\n🌐 Testing Frontend-Backend Communication...")
    
    try:
        # Test parking data endpoint
        response = requests.get(f"{API_BASE}/api/parking", timeout=5)
        
        if response.status_code == 200:
            parking_data = response.json()
            print(f"✅ Parking Data API Working:")
            print(f"   📊 Retrieved {len(parking_data)} parking locations")
            
            # Show sample data structure
            if parking_data:
                sample = parking_data[0]
                print(f"   📋 Sample Structure:")
                for key, value in sample.items():
                    if key not in ['_id']:
                        print(f"      {key}: {value} ({type(value).__name__})")
        else:
            print(f"❌ Parking Data API Failed: HTTP {response.status_code}")
        
        # Test health endpoint
        health_response = requests.get(f"{API_BASE}/api/health", timeout=5)
        if health_response.status_code == 200:
            health = health_response.json()
            print(f"✅ Health Check Working:")
            print(f"   🏥 Status: {health.get('status')}")
            print(f"   🗄️  Database: {health.get('database')}")
            print(f"   🤖 Model: {health.get('model')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Frontend Communication Test Failed: {e}")
        return False

def main():
    """Run all tests and provide summary"""
    print("🚀 Smart Parking Booking System Test")
    print("=" * 50)
    
    # Test 1: Database Connection
    db_ok = test_database_connection()
    
    # Test 2: Booking API
    if db_ok:
        booking_result = test_booking_api()
        
        # Test 3: Verify Database Changes
        if booking_result:
            verify_ok = verify_database_changes()
    
    # Test 4: Frontend Communication
    comm_ok = test_frontend_compatibility()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY:")
    print(f"   ✅ Database Connection: {'PASS' if db_ok else 'FAIL'}")
    print(f"   ✅ Booking API: {'PASS' if booking_result else 'FAIL'}")
    print(f"   ✅ Database Changes: {'PASS' if booking_result and verify_ok else 'FAIL'}")
    print(f"   ✅ Frontend Communication: {'PASS' if comm_ok else 'FAIL'}")
    
    if all([db_ok, booking_result, verify_ok, comm_ok]):
        print("\n🎉 ALL TESTS PASSED!")
        print("📍 Frontend URL: http://localhost:5173")
        print("🔗 Backend API: http://localhost:5000")
        print("🗄️  MongoDB: mongodb://localhost:27017")
        print("\n✅ Your Smart Parking System is fully connected!")
    else:
        print("\n❌ SOME TESTS FAILED!")
        print("Please check the error messages above and fix issues.")

if __name__ == "__main__":
    main()
