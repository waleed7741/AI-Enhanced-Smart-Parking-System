#!/usr/bin/env python3
"""
Quick Fix Script for Booking Issues
"""

import subprocess
import sys
import time
import requests

def check_service(service_name, command, port=None):
    """Check if a service is running"""
    try:
        if port:
            # Check port
            result = subprocess.run(['netstat', '-an'], capture_output=True, text=True)
            if f":{port}" in result.stdout:
                print(f"✅ {service_name} is running on port {port}")
                return True
            else:
                print(f"❌ {service_name} is not running on port {port}")
                return False
        else:
            # Check service
            result = subprocess.run(['sc', 'query', service_name], capture_output=True, text=True)
            if "RUNNING" in result.stdout:
                print(f"✅ {service_name} is running")
                return True
            else:
                print(f"❌ {service_name} is not running")
                return False
    except Exception as e:
        print(f"❌ Error checking {service_name}: {e}")
        return False

def start_service(service_name, start_command):
    """Start a service"""
    try:
        print(f"🚀 Starting {service_name}...")
        result = subprocess.run(start_command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {service_name} started successfully")
            return True
        else:
            print(f"❌ Failed to start {service_name}: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error starting {service_name}: {e}")
        return False

def main():
    """Quick fix for booking issues"""
    print("🔧 Quick Fix for Smart Parking Booking Issues")
    print("=" * 50)
    
    # Check MongoDB
    print("\n1. Checking MongoDB...")
    if not check_service("MongoDB", None, "27017"):
        print("🚀 Starting MongoDB...")
        start_service("MongoDB", "net start MongoDB")
        time.sleep(3)
    
    # Check Backend
    print("\n2. Checking Backend...")
    backend_running = False
    try:
        response = requests.get("http://localhost:5000/api/health", timeout=2)
        if response.status_code == 200:
            backend_running = True
            print("✅ Backend is running")
    except:
        print("❌ Backend is not running")
    
    if not backend_running:
        print("🚀 Starting Backend...")
        try:
            # Start backend in background
            subprocess.Popen(["python", "ml/app.py"], cwd=".")
            time.sleep(5)
            
            # Check again
            response = requests.get("http://localhost:5000/api/health", timeout=2)
            if response.status_code == 200:
                print("✅ Backend started successfully")
            else:
                print("❌ Backend failed to start")
        except Exception as e:
            print(f"❌ Error starting backend: {e}")
    
    # Seed Database
    print("\n3. Seeding Database...")
    try:
        result = subprocess.run(["python", "seed_db.py"], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Database seeded successfully")
        else:
            print(f"❌ Database seeding failed: {result.stderr}")
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
    
    # Test Booking
    print("\n4. Testing Booking...")
    try:
        test_data = {
            "slot_id": 1,
            "user_id": "Test User",
            "duration": 1,
            "amount": 50
        }
        
        response = requests.post(
            "http://localhost:5000/api/book",
            json=test_data,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ Booking test PASSED")
                print(f"   Booking ID: {result.get('booking_id')}")
                print(f"   Parking: {result.get('parking_name')}")
                print(f"   Slot: S-{result.get('slot_number')}")
            else:
                print(f"❌ Booking test FAILED: {result.get('error')}")
        else:
            print(f"❌ Booking test FAILED: HTTP {response.status_code}")
    except Exception as e:
        print(f"❌ Booking test ERROR: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Quick Fix Complete!")
    print("\n📋 Next Steps:")
    print("1. Open browser: http://localhost:3000 or http://localhost:5173")
    print("2. Click 'Book Now' on any parking location")
    print("3. Fill in the booking details")
    print("4. Click 'Confirm Booking'")
    print("5. Should work now! 🚗")
    
    print("\n🔍 If still failing:")
    print("1. Check browser console (F12) for errors")
    print("2. Check backend terminal for detailed logs")
    print("3. Run: python debug_booking.py for detailed analysis")

if __name__ == "__main__":
    main()
