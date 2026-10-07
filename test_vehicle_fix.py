#!/usr/bin/env python3
"""
Test Vehicle Number Fix
"""

import requests
import json

# Configuration
API_BASE = "http://localhost:5000"

def test_vehicle_number_fix():
    """Test that vehicle number is properly saved"""
    print("🧪 Testing Vehicle Number Fix...")
    
    # Test with provided vehicle number
    test_data = {
        "parking_id": 1,
        "slot_id": 1,
        "user_id": "Test User",
        "vehicle_number": "ABC-123",
        "duration": 1,
        "amount": 50
    }
    
    try:
        print(f"📤 Sending Request:")
        print(f"   Vehicle Number: {test_data['vehicle_number']}")
        
        response = requests.post(
            f"{API_BASE}/api/book",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ SUCCESS!")
                print(f"   Booking ID: {result.get('booking_id')}")
                print(f"   Vehicle Number: {result.get('vehicle_number')}")
                print(f"   Expected: {test_data['vehicle_number']}")
                
                if result.get('vehicle_number') == test_data['vehicle_number']:
                    print(f"✅ Vehicle number correctly saved!")
                    return True
                else:
                    print(f"❌ Vehicle number mismatch!")
                    return False
            else:
                print(f"❌ Booking Failed: {result.get('error')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Test Failed: {e}")
        return False

def test_frontend_format():
    """Test with frontend field names"""
    print("\n🧪 Testing Frontend Format...")
    
    # Test with frontend field names
    test_data = {
        "parking_id": 1,
        "slot_id": 1,
        "user_id": "Test User",
        "vehicleNumber": "XYZ-789",
        "duration": 1,
        "amount": 50
    }
    
    try:
        print(f"📤 Sending Request:")
        print(f"   Vehicle Number (vehicleNumber): {test_data['vehicleNumber']}")
        
        response = requests.post(
            f"{API_BASE}/api/book",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print(f"✅ SUCCESS!")
                print(f"   Booking ID: {result.get('booking_id')}")
                print(f"   Vehicle Number: {result.get('vehicle_number')}")
                print(f"   Expected: {test_data['vehicleNumber']}")
                
                if result.get('vehicle_number') == test_data['vehicleNumber']:
                    print(f"✅ Frontend vehicle number correctly saved!")
                    return True
                else:
                    print(f"❌ Vehicle number mismatch!")
                    return False
            else:
                print(f"❌ Booking Failed: {result.get('error')}")
                return False
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Test Failed: {e}")
        return False

def main():
    """Run vehicle number tests"""
    print("🚀 Vehicle Number Fix Test")
    print("=" * 40)
    
    # Test 1: Standard format
    test1_ok = test_vehicle_number_fix()
    
    # Test 2: Frontend format
    test2_ok = test_frontend_format()
    
    print("\n" + "=" * 40)
    print("📊 TEST SUMMARY:")
    print(f"   ✅ Standard Format: {'PASS' if test1_ok else 'FAIL'}")
    print(f"   ✅ Frontend Format: {'PASS' if test2_ok else 'FAIL'}")
    
    if test1_ok and test2_ok:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Vehicle number fix is working correctly!")
        print("\n📋 Frontend will now correctly save your vehicle number!")
    else:
        print("\n❌ SOME TESTS FAILED!")
        print("🔧 Check the backend logs for more details")

if __name__ == "__main__":
    main()
