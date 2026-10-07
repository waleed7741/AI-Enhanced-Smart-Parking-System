#!/usr/bin/env python3
"""
Test Full-Stack Admin Panel Overhaul
Verifies settings APIs, statistics aggregates, and slots status toggles.
"""

import requests
import json
from pymongo import MongoClient

API_BASE = "http://localhost:5000"

def main():
    print("🚀 Running Full-Stack Admin Overhaul Integration Test")
    print("=" * 70)

    # 1. Connect to MongoDB to verify initial collections
    client = MongoClient("mongodb://localhost:27017")
    db = client["SmartParkingDB"]
    settings_col = db["settings"]
    parking_col = db["slots"]

    # 2. Test settings GET API
    print("\n🧪 Step 1: Fetching live settings from /api/settings...")
    res_get = requests.get(f"{API_BASE}/api/settings")
    if res_get.status_code != 200:
        print(f"❌ Failed to fetch settings: {res_get.status_code} - {res_get.text}")
        return

    settings = res_get.json()
    print(f"✅ Settings fetched successfully:\n{json.dumps(settings, indent=2)}")
    
    assert "hourlyRate" in settings, "hourlyRate not found in settings!"
    assert "base_parking_rate" in settings, "base_parking_rate not found in settings!"
    assert settings.get("base_parking_rate") == settings.get("hourlyRate"), "Settings pricing fields out of sync!"

    # 3. Test settings PUT API
    print("\n🧪 Step 2: Updating settings via PUT /api/settings...")
    new_rate = 75
    update_payload = {
        "hourlyRate": new_rate,
        "maxBookingHours": 10,
        "workingHoursStart": "07:00",
        "workingHoursEnd": "23:00"
    }
    
    res_put = requests.put(f"{API_BASE}/api/settings", json=update_payload)
    if res_put.status_code != 200:
        print(f"❌ Failed to update settings: {res_put.status_code} - {res_put.text}")
        return

    update_res = res_put.json()
    print(f"✅ Settings update response:\n{json.dumps(update_res, indent=2)}")
    
    # Check settings collection directly in DB
    db_settings = settings_col.find_one({})
    print(f"🎫 Settings in MongoDB: hourlyRate={db_settings.get('hourlyRate')}, base_parking_rate={db_settings.get('base_parking_rate')}")
    
    assert db_settings.get('hourlyRate') == new_rate, "hourlyRate did not update in DB!"
    assert db_settings.get('base_parking_rate') == new_rate, "base_parking_rate did not update in DB!"
    print("✅ Settings update and bidirectional mapping verified!")

    # 4. Test admin stats API
    print("\n🧪 Step 3: Fetching aggregate stats from /api/admin/stats...")
    res_stats = requests.get(f"{API_BASE}/api/admin/stats")
    if res_stats.status_code != 200:
        print(f"❌ Failed to fetch stats: {res_stats.status_code} - {res_stats.text}")
        return

    stats = res_stats.json()
    print(f"✅ Stats fetched successfully:\n{json.dumps(stats, indent=2)}")
    
    assert "total_parking" in stats, "total_parking not found in stats!"
    assert "total_bookings" in stats, "total_bookings not found in stats!"
    assert "total_users" in stats, "total_users not found in stats!"
    assert "total_revenue" in stats, "total_revenue not found in stats!"
    print("✅ Live stats aggregates verified!")

    # 5. Test slot status management PUT API
    print("\n🧪 Step 4: Testing slot maintenance status toggles...")
    parking_id = 1
    slot_num = "S-2"
    
    # Get initial parking available slots
    parking_before = parking_col.find_one({'id': parking_id})
    initial_avail = parking_before.get('available', 0)
    slot_before = next((s for s in parking_before.get('slot_layouts', []) if s.get('number') == slot_num), None)
    
    print(f"📦 Parking {parking_id} initial available slots: {initial_avail}")
    if slot_before:
        print(f"📍 Slot {slot_num} status: {slot_before.get('status')}, isBooked: {slot_before.get('isBooked')}")

    # Mark slot S-2 as Out of Order
    print(f"\n🛠️ Marking slot {slot_num} as 'Out of Order' via PUT...")
    url_status = f"{API_BASE}/api/parking/{parking_id}/slots/{slot_num}/status"
    res_status1 = requests.put(url_status, json={"status": "Out of Order"})
    if res_status1.status_code != 200:
        print(f"❌ Failed to update slot status: {res_status1.status_code} - {res_status1.text}")
        return

    print(f"✅ Status Update Response: {res_status1.json().get('message')}")
    
    # Verify in DB
    parking_ooo = parking_col.find_one({'id': parking_id})
    slot_ooo = next((s for s in parking_ooo.get('slot_layouts', []) if s.get('number') == slot_num), None)
    print(f"📦 Parking {parking_id} available slots after OOO: {parking_ooo.get('available')}")
    if slot_ooo:
        print(f"📍 Slot {slot_num} status: {slot_ooo.get('status')}, isBooked: {slot_ooo.get('isBooked')}")
        
    assert parking_ooo.get('available') == initial_avail - 1, "Available slots did not decrement!"
    assert slot_ooo.get('status') == 'Out of Order', "Status did not set to Out of Order!"
    assert slot_ooo.get('isBooked') is True, "Slot was not marked as isBooked!"
    print("✅ Slot successfully closed for maintenance and capacity decremented!")

    # Mark slot S-2 back to available
    print(f"\n🛠️ Restoring slot {slot_num} back to service ('available') via PUT...")
    res_status2 = requests.put(url_status, json={"status": "available"})
    if res_status2.status_code != 200:
        print(f"❌ Failed to restore slot status: {res_status2.status_code} - {res_status2.text}")
        return

    print(f"✅ Status Restore Response: {res_status2.json().get('message')}")
    
    # Verify in DB
    parking_avail = parking_col.find_one({'id': parking_id})
    slot_avail = next((s for s in parking_avail.get('slot_layouts', []) if s.get('number') == slot_num), None)
    print(f"📦 Parking {parking_id} available slots after restore: {parking_avail.get('available')}")
    if slot_avail:
        print(f"📍 Slot {slot_num} status: {slot_avail.get('status')}, isBooked: {slot_avail.get('isBooked')}")
        
    assert parking_avail.get('available') == initial_avail, "Available slots did not increment back!"
    assert slot_avail.get('status') == 'available', "Status did not restore to available!"
    assert slot_avail.get('isBooked') is False, "Slot isBooked was not cleared!"
    print("✅ Slot successfully restored to standard service and capacity incremented!")

    # Restore settings back to default 50
    requests.put(f"{API_BASE}/api/settings", json={"hourlyRate": 50})

    print("\n" + "=" * 70)
    print("🎉 ALL TESTS PASSED! FULL-STACK ADMIN OVERHAUL OPERATES PERFECTLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
