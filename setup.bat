@echo off
echo 🚀 Setting up Smart Parking System with MongoDB...

REM Check if MongoDB is running (Windows)
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I "mongod.exe"
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  MongoDB is not running. Please start MongoDB first:
    echo    net start MongoDB
    echo    or run mongod.exe directly
    pause
    exit /b 1
)

REM Install Python dependencies
echo 📦 Installing Python dependencies...
pip install -r ml/requirements.txt

REM Seed the database
echo 🌱 Seeding MongoDB with parking data...
python seed_db.py

REM Start the Flask backend
echo 🔥 Starting Flask backend...
cd ml
python app.py

echo.
echo ✅ Backend started! Testing booking system...
echo.

REM Test the complete booking flow
echo 🧪 Running booking test...
python test_booking.py

echo.
echo 🎉 Setup Complete!
echo 📍 Frontend: http://localhost:5173
echo 🔗 Backend API: http://localhost:5000
echo 🗄️  MongoDB: mongodb://localhost:27017
echo.
echo 🧪 Quick Test: Run 'quick_test.bat' for cURL test
pause
