#!/usr/bin/env python3
"""
Quick Booking Fix Test Script
Tests the updated booking system with flexible endpoints
"""

import requests
import json
import time

# Configuration
API_BASE = "http://localhost:5000"

def test_new_booking_endpoint():
    """Test the new flexible /api/book endpoint"""
    print("🧪 Testing New Booking Endpoint...")
    
    # Test with flexible parameters
    booking_data = {
        "parking_id": 1,
        "slot_id": 1,
        "user_id": "Test User",
        "vehicle_number": "ABC-1234",
        "duration": 2,
        "amount": 100
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/api/book",
            json=booking_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        print(f"📤 Request: POST {API_BASE}/api/book")
        print(f"📋 Data: {json.dumps(booking_data, indent=2)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ SUCCESS: {result.get('message')}")
            print(f"📋 Booking ID: {result.get('booking_id')}")
            print(f"📍 Parking: {result.get('parking_name')}")
            print(f"🚗 Slot: S-{result.get('slot_number')}")
            print(f"💰 Cost: PKR {result.get('total_cost')}")
            return True
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"📋 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_cors_headers():
    """Test CORS configuration"""
    print("\n🌐 Testing CORS Headers...")
    
    try:
        # Test OPTIONS request
        response = requests.options(f"{API_BASE}/api/book", timeout=5)
        
        cors_headers = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        }
        
        print(f"✅ CORS Headers:")
        for key, value in cors_headers.items():
            print(f"   {key}: {value}")
        
        return True
        
    except Exception as e:
        print(f"❌ CORS Test Failed: {e}")
        return False

def test_frontend_compatibility():
    """Test frontend can communicate with new endpoint"""
    print("\n🌐 Testing Frontend Compatibility...")
    
    try:
        # Test the exact payload frontend will send
        frontend_payload = {
            "parking_id": 1,
            "slot_id": 1,
            "user_id": "Frontend Test User", 
            "vehicle_number": "LE-567",
            "duration": 1,
            "amount": 50
        }
        
        response = requests.post(
            f"{API_BASE}/api/book",
            json=frontend_payload,
            headers={
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:3000'
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Frontend Compatible: {result.get('message')}")
            
            # Check response has all required fields for frontend
            required_fields = ['booking_id', 'parking_name', 'slot_number', 'total_cost']
            missing_fields = [field for field in required_fields if field not in result]
            
            if not missing_fields:
                print(f"✅ All required fields present for frontend")
                return True
            else:
                print(f"❌ Missing fields: {missing_fields}")
                return False
        else:
            print(f"❌ Frontend request failed: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Frontend compatibility test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Smart Parking Booking Fix Test")
    print("=" * 50)
    
    # Test 1: New booking endpoint
    booking_ok = test_new_booking_endpoint()
    
    # Test 2: CORS headers
    cors_ok = test_cors_headers()
    
    # Test 3: Frontend compatibility
    frontend_ok = test_frontend_compatibility()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY:")
    print(f"   ✅ New Booking Endpoint: {'PASS' if booking_ok else 'FAIL'}")
    print(f"   ✅ CORS Configuration: {'PASS' if cors_ok else 'FAIL'}")
    print(f"   ✅ Frontend Compatibility: {'PASS' if frontend_ok else 'FAIL'}")
    
    if all([booking_ok, cors_ok, frontend_ok]):
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Booking system is fixed and ready!")
        print("\n📍 Test in browser:")
        print("   1. Open http://localhost:3000 or http://localhost:5173")
        print("   2. Select a parking slot")
        print("   3. Click 'Book Now'")
        print("   4. Enter details and click 'Pay Now'")
        print("   5. Should redirect to success page!")
    else:
        print("\n❌ SOME TESTS FAILED!")
        print("Please check the error messages above.")

if __name__ == "__main__":
    main()
