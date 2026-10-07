#!/usr/bin/env python3
"""
Comprehensive Booking System Debug and Fix Script
Identifies and fixes common booking failure issues
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

def check_backend_status():
    """Check if backend is running and healthy"""
    print("🔍 Checking Backend Status...")
    
    try:
        response = requests.get(f"{API_BASE}/api/health", timeout=5)
        if response.status_code == 200:
            health = response.json()
            print(f"✅ Backend Status: {health.get('status')}")
            print(f"🗄️  Database: {health.get('database')}")
            print(f"🤖 Model: {health.get('model')}")
            return True
        else:
            print(f"❌ Backend Health Check Failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend Connection Failed: {e}")
        return False

def check_database_connection():
    """Check MongoDB connection and data"""
    print("\n🗄️  Checking Database Connection...")
    
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        
        # Test connection
        client.admin.command('ping')
        print(f"✅ MongoDB Connected: {MONGO_URI}")
        
        # Check collections
        slots_collection = db[COLLECTION_NAME]
        bookings_collection = db[BOOKINGS_COLLECTION]
        
        slots_count = slots_collection.count_documents({})
        bookings_count = bookings_collection.count_documents({})
        
        print(f"📊 Database Stats:")
        print(f"   🚗 Slots Collection: {slots_count} documents")
        print(f"   📋 Bookings Collection: {bookings_count} documents")
        
        # Check sample parking data
        sample_parking = slots_collection.find_one()
        if sample_parking:
            print(f"   📍 Sample Parking: {sample_parking.get('name')} (ID: {sample_parking.get('id')})")
            print(f"   🚗 Available: {sample_parking.get('available')}/{sample_parking.get('capacity')}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ Database Connection Failed: {e}")
        return False

def test_booking_endpoint():
    """Test the booking endpoint with detailed debugging"""
    print("\n🧪 Testing Booking Endpoint...")
    
    # Test data
    test_booking = {
        "slot_id": 1,
        "user_id": "Debug User",
        "duration": 1,
        "amount": 50
    }
    
    try:
        print(f"📤 Sending Request:")
        print(f"   URL: {API_BASE}/api/book")
        print(f"   Method: POST")
        print(f"   Headers: Content-Type: application/json")
        print(f"   Body: {json.dumps(test_booking, indent=4)}")
        
        response = requests.post(
            f"{API_BASE}/api/book",
            json=test_booking,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"\n📥 Response:")
        print(f"   Status Code: {response.status_code}")
        print(f"   Headers: {dict(response.headers)}")
        
        try:
            response_data = response.json()
            print(f"   Body: {json.dumps(response_data, indent=4)}")
            
            if response.status_code == 200 and response_data.get('success'):
                print(f"✅ Booking Test PASSED")
                return True
            else:
                print(f"❌ Booking Test FAILED")
                return False
                
        except json.JSONDecodeError:
            print(f"   Body (Raw): {response.text}")
            print(f"❌ Invalid JSON Response")
            return False
            
    except Exception as e:
        print(f"❌ Booking Test Error: {e}")
        return False

def check_common_issues():
    """Check for common booking issues"""
    print("\n🔍 Checking Common Issues...")
    
    issues = []
    
    # Check if backend is running
    try:
        response = requests.get(f"{API_BASE}/api/health", timeout=2)
        if response.status_code != 200:
            issues.append("Backend not responding correctly")
    except:
        issues.append("Backend not running or not accessible")
    
    # Check MongoDB
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command('ping')
        client.close()
    except:
        issues.append("MongoDB not running or not accessible")
    
    # Check parking data
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        db = client[DB_NAME]
        slots_collection = db[COLLECTION_NAME]
        
        parking = slots_collection.find_one({'id': 1})
        if not parking:
            issues.append("No parking data found in database")
        elif parking.get('available', 0) <= 0:
            issues.append("No available slots in parking lot 1")
        
        client.close()
    except:
        issues.append("Cannot access parking data")
    
    if issues:
        print(f"❌ Issues Found:")
        for i, issue in enumerate(issues, 1):
            print(f"   {i}. {issue}")
        return False
    else:
        print(f"✅ No Common Issues Found")
        return True

def provide_solutions():
    """Provide solutions for common problems"""
    print("\n💡 Common Solutions:")
    print("1. Start MongoDB:")
    print("   Windows: net start MongoDB")
    print("   Linux/Mac: sudo systemctl start mongod")
    print()
    print("2. Start Backend:")
    print("   cd ml && python app.py")
    print()
    print("3. Seed Database:")
    print("   python seed_db.py")
    print()
    print("4. Check Port Conflicts:")
    print("   netstat -an | findstr :5000")
    print()
    print("5. Clear Browser Cache:")
    print("   Open DevTools → Network → Disable cache")

def main():
    """Run comprehensive debugging"""
    print("🚀 Smart Parking Booking System Debug")
    print("=" * 60)
    
    # Step 1: Check backend
    backend_ok = check_backend_status()
    
    # Step 2: Check database
    db_ok = check_database_connection()
    
    # Step 3: Check common issues
    issues_ok = check_common_issues()
    
    # Step 4: Test booking endpoint
    if backend_ok and db_ok:
        booking_ok = test_booking_endpoint()
    else:
        booking_ok = False
        print("\n⚠️  Skipping booking test due to backend/database issues")
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 DEBUG SUMMARY:")
    print(f"   ✅ Backend Status: {'PASS' if backend_ok else 'FAIL'}")
    print(f"   ✅ Database Connection: {'PASS' if db_ok else 'FAIL'}")
    print(f"   ✅ Common Issues: {'PASS' if issues_ok else 'FAIL'}")
    print(f"   ✅ Booking Endpoint: {'PASS' if booking_ok else 'FAIL'}")
    
    if all([backend_ok, db_ok, issues_ok, booking_ok]):
        print("\n🎉 ALL CHECKS PASSED!")
        print("✅ Booking system should work correctly")
    else:
        print("\n❌ ISSUES FOUND!")
        provide_solutions()
        
        print("\n🔧 Quick Fix Commands:")
        print("1. Start MongoDB: net start MongoDB")
        print("2. Seed Database: python seed_db.py")
        print("3. Start Backend: cd ml && python app.py")
        print("4. Test Frontend: Open http://localhost:3000")

if __name__ == "__main__":
    main()
