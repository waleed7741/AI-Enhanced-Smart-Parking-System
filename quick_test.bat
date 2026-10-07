@echo off
echo 🧪 Quick Booking Test with cURL
echo ==================================

echo.
echo 📤 Sending booking request...
curl -X POST http://localhost:5000/api/book_slot ^
  -H "Content-Type: application/json" ^
  -d "{\"parking_id\": 1, \"user_name\": \"Test User\", \"vehicle_number\": \"TEST-123\", \"duration_hours\": 2}" ^
  -w "\n📥 HTTP Status: %%{http_code}\n⏱️  Time: %%{time_total}s\n📋 Response Size: %%{size_download} bytes\n"

echo.
echo 🔍 To verify in MongoDB, run:
echo    use SmartParkingDB
echo    db.bookings.find({"vehicle_number": "TEST-123"}).pretty()
echo.
echo    db.slots.find({"id": 1}).pretty()
echo.
echo ✅ Test Complete!
echo 📍 Frontend: http://localhost:5173
echo 🔗 Backend: http://localhost:5000
echo 🗄️  MongoDB: mongodb://localhost:27017
pause
