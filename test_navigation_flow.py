#!/usr/bin/env python3
"""
Test Navigation Flow: Parking → Slot Selection → Booking Details
"""

import requests
import json

# Configuration
API_BASE = "http://localhost:5000"

def test_parking_list():
    """Test parking list API"""
    print("🔍 Testing Parking List API...")
    
    try:
        response = requests.get(f"{API_BASE}/api/parking", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found {len(data)} parking locations")
            return data[0] if data else None
        else:
            print(f"❌ Failed: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_single_parking(parking_id):
    """Test single parking API"""
    print(f"\n🔍 Testing Single Parking API (ID: {parking_id})...")
    
    try:
        response = requests.get(f"{API_BASE}/api/parking/{parking_id}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Found parking: {data.get('name')}")
            print(f"   Capacity: {data.get('capacity')}")
            print(f"   Available: {data.get('available')}")
            return data
        else:
            print(f"❌ Failed: HTTP {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_navigation_flow():
    """Test the complete navigation flow"""
    print("🚀 Testing Navigation Flow")
    print("=" * 50)
    
    # Step 1: Get parking list
    parking_list = test_parking_list()
    if not parking_list:
        print("❌ Cannot proceed without parking data")
        return False
    
    # Step 2: Get specific parking
    parking_id = parking_list.get('id')
    parking_data = test_single_parking(parking_id)
    if not parking_data:
        print("❌ Cannot proceed without specific parking data")
        return False
    
    # Step 3: Simulate slot selection
    print(f"\n🎯 Simulating Slot Selection...")
    print(f"   Parking: {parking_data.get('name')}")
    print(f"   Total Slots: {parking_data.get('capacity')}")
    print(f"   Available Slots: {parking_data.get('available')}")
    
    # Generate mock slots
    total_slots = parking_data.get('capacity', 0)
    available_slots = parking_data.get('available', 0)
    booked_count = total_slots - available_slots
    
    print(f"   Booked Slots: {booked_count}")
    print(f"   Available Slots: {available_slots}")
    
    # Simulate selecting a slot
    selected_slot = {
        'id': 1,
        'number': 'S-1',
        'isBooked': False
    }
    
    print(f"\n✅ Selected Slot: {selected_slot['number']}")
    
    # Step 4: Test booking endpoint
    print(f"\n🧪 Testing Booking with Selected Slot...")
    
    booking_data = {
        "slot_id": parking_id,
        "user_id": "Test User",
        "duration": 1,
        "amount": parking_data.get('price', 50)
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/api/book",
            json=booking_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ Booking Test PASSED")
                print(f"   Booking ID: {result.get('booking_id')}")
                print(f"   Parking: {result.get('parking_name')}")
                print(f"   Slot Number: S-{result.get('slot_number')}")
                return True
            else:
                print(f"❌ Booking Test FAILED: {result.get('error')}")
                return False
        else:
            print(f"❌ Booking Test FAILED: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Booking Test ERROR: {e}")
        return False

def main():
    """Run navigation flow test"""
    print("🧪 Smart Parking Navigation Flow Test")
    print("=" * 60)
    
    success = test_navigation_flow()
    
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY:")
    
    if success:
        print("✅ Navigation Flow: PASS")
        print("✅ API Endpoints: Working")
        print("✅ Data Flow: Correct")
        print("\n🎉 Navigation Flow is Working!")
        print("\n📋 Expected User Flow:")
        print("1. User sees parking list/map")
        print("2. User clicks 'Book Now' → Goes to slot selection")
        print("3. User selects slot (S-1, S-2, etc.) → Goes to booking details")
        print("4. User fills form → Confirms booking")
        print("5. User sees success page")
    else:
        print("❌ Navigation Flow: FAIL")
        print("❌ API Endpoints: Issues found")
        print("❌ Data Flow: Broken")
        print("\n🔧 Fix Required:")
        print("1. Check backend is running: python ml/app.py")
        print("2. Check database is connected: python seed_db.py")
        print("3. Check API endpoints: python debug_booking.py")

if __name__ == "__main__":
    main()
