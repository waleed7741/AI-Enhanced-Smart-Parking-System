"""
Smart Parking System - Complete Integration Guide
=================================================

This guide covers connecting:
1. React/Vite Frontend (port 3000/5173)
2. Python Flask Backend (port 5000)
3. MongoDB Database
4. ML Model (parking_model.pkl)
"""

"""
==================================================================================
STEP 1: MONGODB SETUP
==================================================================================

1.1 Install MongoDB (if not installed):
   - Download from: https://www.mongodb.com/try/download/community
   - Install with default settings
   - MongoDB runs on port 27017 by default

1.2 Start MongoDB:
   - Windows: Start MongoDB service or run "mongod"
   - Or use MongoDB Compass (GUI tool)

1.3 Seed the database with parking data:
   Open terminal in project root and run:

   python seed_db.py

   This will create:
   - Database: SmartParkingDB
   - Collections: slots, bookings
   - 5 parking locations with real data
"""

"""
==================================================================================
STEP 2: ML MODEL SETUP
==================================================================================

2.1 Train the model (if not trained):
   cd ml
   python preprocess.py    # Clean data
   python train.py        # Train model (creates parking_model.pkl)

   This creates in ml/ folder:
   - parking_model.pkl    (trained model)
   - scaler.pkl           (feature scaler)
   - encoders.pkl         (label encoders)
   - feature_order.pkl    (feature order)

2.2 Required files in ml/ folder:
   - parking_model.pkl (or parking_model.h5 for Keras)
   - scaler.pkl
   - encoders.pkl
   - feature_order.pkl
"""

"""
==================================================================================
STEP 3: START BACKEND
==================================================================================

3.1 Install backend dependencies:
   cd ml
   pip install -r requirements.txt

3.2 Run the Flask server:
   python app.py

   Or use the run script:
   python run_server.py

   Backend runs on: http://127.0.0.1:5000

3.3 Test the backend:
   - http://127.0.0.1:5000/                    (health check)
   - http://127.0.0.1:5000/api/health          (detailed health)
   - http://127.0.0.1:5000/api/parking         (all parking)
   - http://127.0.0.1:5000/meta                (ML model info)
"""

"""
==================================================================================
STEP 4: START FRONTEND
==================================================================================

4.1 Install frontend dependencies:
   cd Frontend
   npm install

4.2 Create .env file in Frontend/:
   VITE_API_URL=http://127.0.0.1:5000

4.3 Run the frontend:
   npm run dev

   Frontend runs on: http://localhost:5173 (or 3000)
"""

"""
==================================================================================
STEP 5: VERIFY CONNECTIONS
==================================================================================

Test from browser or Postman:

1. Health Check:
   GET http://127.0.0.1:5000/api/health
   Expected: {"status": "healthy", "database": "connected", "model": "loaded"}

2. Get Parking Data:
   GET http://127.0.0.1:5000/api/parking
   Expected: Array of parking locations

3. ML Prediction:
   POST http://127.0.0.1:5000/predict
   Body: {
     "hour": 10,
     "day_of_week": 1,
     "is_weekend": 0,
     "Nearby_Traffic_Level": "Low",
     "Weather_Temperature": 25,
     "Weather_Precipitation": 0,
     "Proximity_To_Exit": 5,
     "Spot_Size": "Standard"
   }
   Expected: {"availability_probability": 0.75, "available": true}

4. Make Booking:
   POST http://127.0.0.1:5000/api/book
   Body: {
     "parking_id": 1,
     "user_name": "John Doe",
     "vehicle_number": "ABC-123",
     "duration": 2,
     "amount": 100
   }
   Expected: {"success": true, "booking_id": "..."}
"""

"""
==================================================================================
STEP 6: FRONTEND FILES STRUCTURE
==================================================================================

Frontend/src/
├── components/
│   ├── Navbar.jsx           - Navigation bar
│   └── AdminLayout.jsx     - Admin panel layout
├── pages/
│   ├── MapView.jsx         - Main map (fetches from API)
│   ├── SlotSelection.jsx   - Slot picker
│   ├── BookingDetails.jsx  - Car details form
│   ├── Payment.jsx         - Payment page
│   ├── BookingConfirmation.jsx - Booking success
│   ├── Navigation.jsx      - Directions map
│   ├── AdminDashboard.jsx  - Admin overview
│   ├── AdminParking.jsx    - Manage parking
│   ├── AdminBookings.jsx   - Manage bookings
│   └── ...
├── App.jsx                 - Routes configuration
└── main.jsx               - Entry point
"""

"""
==================================================================================
STEP 7: API ENDPOINTS SUMMARY
==================================================================================

BACKEND API (Flask on port 5000):
---------------------------------
GET  /                         - Server running check
GET  /meta                     - ML model metadata
POST /predict                  - ML prediction

GET  /api/parking              - Get all parking spots
GET  /api/parking/<id>         - Get parking by ID
PUT  /api/parking/<id>/update  - Update parking availability

POST /api/book                 - Book a parking slot
GET  /api/bookings             - Get all bookings
GET  /api/bookings/<vehicle>   - Get booking by vehicle

GET  /api/users                - Get all users
PUT  /api/users/<id>           - Update user (block/unblock)

GET  /api/health               - Health check

FRONTEND ROUTES:
----------------
/                    - Home page
/map                 - Map with parking locations
/list                - Parking list view
/slots/:id           - Slot selection
/booking-details     - Car details form
/payment             - Payment page
/booking-confirmed   - Booking success
/navigation          - Directions map
/contact             - Contact form
/dashboard           - Analytics dashboard
/admin               - Admin panel (all routes)
/admin/parking        - Manage parking
/admin/bookings      - Manage bookings
/admin/users         - Manage users
/admin/analytics     - Analytics charts
/admin/ml            - ML model management
/admin/settings      - System settings
"""

"""
==================================================================================
TROUBLESHOOTING
==================================================================================

1. "MongoDB connection error":
   - Make sure MongoDB is running
   - Check MONGO_URI in app.py

2. "Model not found":
   - Ensure parking_model.pkl exists in ml/ folder
   - Run python train.py to create the model

3. CORS errors:
   - Backend has CORS configured for localhost:3000 and 5173
   - Check flask-cors is installed

4. Frontend can't connect to backend:
   - Create .env file with VITE_API_URL
   - Restart frontend after adding .env

5. Booking fails:
   - Check MongoDB is running
   - Verify parking data exists: GET /api/parking
   - Check browser console for errors

6. ML prediction error:
   - Verify scaler.pkl and encoders.pkl exist
   - Check model input format matches expected features
"""

print("""
==================================================================================
QUICK START COMMANDS
==================================================================================

# Terminal 1: Start MongoDB (if local installation)
mongod

# Terminal 2: Seed Database
python seed_db.py

# Terminal 3: Start Backend
cd ml
python app.py

# Terminal 4: Start Frontend
cd Frontend
npm run dev

Then open: http://localhost:5173
==================================================================================
""")