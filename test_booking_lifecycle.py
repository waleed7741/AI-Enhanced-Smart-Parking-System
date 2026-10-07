#!/usr/bin/env python3
"""
Test Booking Lifecycle Automation
Verifies the automated complete & release slot flow.
"""

import requests
import json
from pymongo import MongoClient

API_BASE = "http://localhost:5000"

def main():
    print("🚀 Running Booking Lifecycle Automation Test")
    print("=" * 60)

    # 1. Connect to MongoDB to check state directly
    client = MongoClient("mongodb://localhost:27017")
    db = client["SmartParkingDB"]
    parking_col = db["slots"]
    bookings_col = db["bookings"]

    # 2. Get initial slot state
    parking_id = 1
    slot_num = "S-1"
    
    parking_before = parking_col.find_one({'id': parking_id})
    if not parking_before:
        print("❌ Error: Centaurus Mall Parking lot (ID 1) not found in DB.")
        return

    initial_available = parking_before.get('available', 0)
    print(f"📦 Initial Lot Available Slots: {initial_available}")

    # Find the S-1 slot layout status
    s1_slot_before = next((s for s in parking_before.get('slot_layouts', []) if s.get('number') == slot_num), None)
    if s1_slot_before:
        print(f"📍 Initial Slot {slot_num} isBooked status: {s1_slot_before.get('isBooked')}")

    # 3. Create a booking via API
    booking_payload = {
        "parking_id": parking_id,
        "slot_id": 1,
        "slot_number": slot_num,
        "user_name": "Lifecycle Test User",
        "user_email": "test@lifecycle.com",
        "vehicle_number": "LC-8888",
        "duration": 2,
        "amount": 200
    }

    print("\n🧪 Step 1: Creating a dynamic booking via POST /api/book...")
    res = requests.post(f"{API_BASE}/api/book", json=booking_payload)
    if res.status_code != 200:
        print(f"❌ Failed to create booking: {res.status_code} - {res.text}")
        return

    booking_res = res.json()
    if not booking_res.get('success'):
        print(f"❌ Booking logic reported failure: {booking_res}")
        return

    booking_id = booking_res.get('booking_id')
    print(f"✅ Booking created successfully! Booking ID: {booking_id}")

    # 4. Check lot and slot state occupied
    parking_occupied = parking_col.find_one({'id': parking_id})
    s1_slot_occupied = next((s for s in parking_occupied.get('slot_layouts', []) if s.get('number') == slot_num), None)
    
    print(f"📦 Lot Available Slots after Booking: {parking_occupied.get('available')}")
    if s1_slot_occupied:
        print(f"📍 Slot {slot_num} isBooked status: {s1_slot_occupied.get('isBooked')}")
        
    assert parking_occupied.get('available') == initial_available - 1, "Available slots count did not decrement!"
    assert s1_slot_occupied.get('isBooked') is True, "Slot layout was not marked as booked!"
    print("✅ Booking correctly updated capacity and slot layouts in MongoDB.")

    # 5. Call the new finish endpoint
    print(f"\n🧪 Step 2: Triggering new finish endpoint POST /api/bookings/{booking_id}/finish...")
    res_finish = requests.post(f"{API_BASE}/api/bookings/{booking_id}/finish")
    
    if res_finish.status_code != 200:
        print(f"❌ Failed to finish booking: {res_finish.status_code} - {res_finish.text}")
        return

    finish_res = res_finish.json()
    print(f"✅ Finish API Response: {json.dumps(finish_res, indent=2)}")
    
    assert finish_res.get('success') is True, "Finish endpoint did not report success!"
    assert finish_res.get('status') == 'completed', "Status is not completed!"

    # 6. Check state released
    parking_released = parking_col.find_one({'id': parking_id})
    s1_slot_released = next((s for s in parking_released.get('slot_layouts', []) if s.get('number') == slot_num), None)
    booking_doc = bookings_col.find_one({'booking_id': booking_id})

    print(f"\n📦 Lot Available Slots after Release: {parking_released.get('available')}")
    if s1_slot_released:
        print(f"📍 Slot {slot_num} isBooked status: {s1_slot_released.get('isBooked')}")
    print(f"🎫 DB Booking Status: {booking_doc.get('status')}")

    assert parking_released.get('available') == initial_available, "Available slots did not increment back!"
    assert s1_slot_released.get('isBooked') is False, "Slot layout was not cleared/released!"
    assert booking_doc.get('status') == 'completed', "Booking status did not transition to completed!"

    print("\n" + "=" * 60)
    print("🎉 ALL TESTS PASSED! BOOKING LIFECYCLE AUTOMATION IS WORKING PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
