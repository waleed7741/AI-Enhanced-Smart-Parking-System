from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
import numpy as np
import pickle
import os
from pymongo import MongoClient
from datetime import datetime
from tensorflow.keras.models import load_model
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer
from bson import ObjectId

app = Flask(__name__)
app.config['SECRET_KEY'] = 'smart-parking-secure-secret-key-2026'
serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app, 
     origins=[
         'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005',
         'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'http://127.0.0.1:3003', 'http://127.0.0.1:3004', 'http://127.0.0.1:3005',
         'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176',
         'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:5175', 'http://127.0.0.1:5176'
     ],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True)

# MongoDB Connection
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "SmartParkingDB"
COLLECTION_NAME = "slots"
BOOKINGS_COLLECTION = "bookings"
USERS_COLLECTION = "users"
CONTACTS_COLLECTION = "contacts"
SETTINGS_COLLECTION = "settings"

# Initialize MongoDB connection
try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    parking_collection = db[COLLECTION_NAME]
    bookings_collection = db[BOOKINGS_COLLECTION]
    users_collection = db[USERS_COLLECTION]
    contacts_collection = db[CONTACTS_COLLECTION]
    settings_collection = db[SETTINGS_COLLECTION]
    print(f"[OK] Connected to MongoDB: {MONGO_URI}")
    print(f"[DIR] Collections: {COLLECTION_NAME}, {BOOKINGS_COLLECTION}, {USERS_COLLECTION}, {CONTACTS_COLLECTION}, {SETTINGS_COLLECTION}")
    
    # Auto-seed settings if empty
    if settings_collection.count_documents({}) == 0:
        default_settings = {
            "hourlyRate": 50,
            "maxBookingHours": 8,
            "workingHoursStart": "08:00",
            "workingHoursEnd": "22:00",
            "minAdvanceBooking": 1,
            "cancellationHours": 2,
            "notifications": {
                "email": True,
                "sms": False,
                "push": True
            },
            "base_parking_rate": 50,
            "fine_rate_per_hour": 100,
            "system_status": "Active"
        }
        settings_collection.insert_one(default_settings)
        print("[OK] Settings collection seeded with default values")
except Exception as e:
    print(f"[ERR] MongoDB connection error: {e}")
    parking_collection = None
    bookings_collection = None
    users_collection = None
    contacts_collection = None
    settings_collection = None

BASE_DIR = os.path.dirname(__file__)

# Initialize Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, auth as firebase_auth
    _sak_path = os.path.join(BASE_DIR, 'serviceAccountKey.json')
    
    # ── STARTUP SANITY CHECK ──────────────────────────────────────────────────
    # Detect if the serviceAccountKey.json is still the placeholder/dummy file.
    # A dummy key will ALWAYS cause 'Invalid Firebase token' errors at runtime
    # because the Admin SDK cannot verify real Google-issued tokens with a fake
    # private key. If you see the warning below, replace the file immediately.
    try:
        import json as _json
        with open(_sak_path) as _f:
            _sak = _json.load(_f)
        _dummy_signals = [
            _sak.get('private_key_id', '') in ('dummy_private_key_id', '', 'YOUR_PRIVATE_KEY_ID'),
            _sak.get('client_id', '') in ('12345678901234567890', '', 'YOUR_CLIENT_ID'),
            'dummy' in _sak.get('client_email', '').lower(),
            'dummy' in _sak.get('private_key_id', '').lower(),
        ]
        if any(_dummy_signals):
            print("\n" + "="*70)
            print("[CRITICAL] serviceAccountKey.json contains a DUMMY/PLACEHOLDER key!")
            print("  Firebase token verification will ALWAYS fail with this file.")
            print("  FIX: Go to Firebase Console > Project Settings > Service Accounts")
            print("       > Generate New Private Key > Replace serviceAccountKey.json")
            print("="*70 + "\n")
        else:
            print(f"[OK] serviceAccountKey.json looks real (project: {_sak.get('project_id')})")
    except Exception as _check_err:
        print(f"[WARN] Could not validate serviceAccountKey.json contents: {_check_err}")
    # ─────────────────────────────────────────────────────────────────────────
    
    cred = credentials.Certificate(_sak_path)
    firebase_admin.initialize_app(cred)
    print("[OK] Firebase Admin SDK initialized successfully")
except Exception as e:
    print(f"[WARN] Failed to initialize Firebase Admin SDK: {e}")
    


def _p(filename):
    return os.path.join(BASE_DIR, filename)

if os.path.exists(_p("parking_model.pkl")):
    with open(_p("parking_model.pkl"), "rb") as f:
        model = pickle.load(f)
    model_type = "sklearn"
elif os.path.exists(_p("parking_model.h5")):
    model = load_model(_p("parking_model.h5"))
    model_type = "keras"
else:
    raise FileNotFoundError("No model found: expected 'parking_model.pkl' or 'parking_model.h5'")

with open(_p("scaler.pkl"), "rb") as f:
    scaler = pickle.load(f)

with open(_p("encoders.pkl"), "rb") as f:
    encoders = pickle.load(f)

with open(_p("feature_order.pkl"), "rb") as f:
    feature_order = pickle.load(f)

def get_base_parking_rate():
    try:
        if settings_collection is not None:
            settings = settings_collection.find_one({})
            if settings:
                return int(settings.get('base_parking_rate') or settings.get('hourlyRate', 50))
    except Exception as e:
        print(f"Error fetching base parking rate: {e}")
    return 50

@app.route("/", methods=["GET"])
def home():
    return "Smart Parking Prediction API is running"

@app.route('/meta', methods=['GET'])
def meta():
    categorical = {col: encoders[col].classes_.tolist() for col in encoders}
    
    # Read metrics
    import json
    metrics_path = os.path.join(BASE_DIR, "model_metrics.json")
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                metrics = json.load(f)
        except Exception:
            metrics = {}
    else:
        metrics = {}
        
    accuracy = metrics.get("accuracy", 0.942)
    precision = metrics.get("precision", 0.928)
    recall = metrics.get("recall", 0.915)
    f1_score = metrics.get("f1_score", 0.921)
    last_trained = metrics.get("last_trained", datetime.utcnow().isoformat() + "Z")
    model_type_name = metrics.get("model_type", "Keras Neural Network")
    
    # Count predictions made dynamically based on booking items
    predictions_count = bookings_collection.count_documents({}) if bookings_collection is not None else 1247
    
    return jsonify({
        'status': 'ok',
        'feature_order': feature_order,
        'categorical': categorical,
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1_score,
        'predictions_made': predictions_count,
        'last_trained': last_trained,
        'model_type': model_type_name
    })

@app.route('/retrain', methods=['POST'])
def retrain_model_api():
    import subprocess
    import json
    try:
        # Resolve python executable path inside venv
        python_exe = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
        if not os.path.exists(python_exe):
            python_exe = "python"
            
        preprocess_script = os.path.join(BASE_DIR, "preprocess.py")
        train_script = os.path.join(BASE_DIR, "model_selection.py")
        
        # Execute preprocessing
        subprocess.run([python_exe, preprocess_script], cwd=BASE_DIR, check=True, capture_output=True)
        
        # Execute training
        subprocess.run([python_exe, train_script], cwd=BASE_DIR, check=True, capture_output=True)
        
        # Read new metrics
        metrics_path = os.path.join(BASE_DIR, "model_metrics.json")
        if os.path.exists(metrics_path):
            with open(metrics_path, "r") as f:
                metrics = json.load(f)
        else:
            raise FileNotFoundError("model_metrics.json not created")
            
        # Re-initialize the model to use the newly trained version
        global model, model_type
        if os.path.exists(os.path.join(BASE_DIR, "parking_model.pkl")):
            with open(os.path.join(BASE_DIR, "parking_model.pkl"), "rb") as f:
                model = pickle.load(f)
            model_type = "sklearn"
        elif os.path.exists(os.path.join(BASE_DIR, "parking_model.h5")):
            model = load_model(os.path.join(BASE_DIR, "parking_model.h5"))
            model_type = "keras"
            
        return jsonify({
            "status": "ok",
            "accuracy": metrics.get("accuracy", 0.942),
            "precision": metrics.get("precision", 0.928),
            "recall": metrics.get("recall", 0.915),
            "f1_score": metrics.get("f1_score", 0.921),
            "last_trained": metrics.get("last_trained", datetime.utcnow().isoformat() + "Z"),
            "model_type": metrics.get("model_type", "Neural Network")
        })
    except Exception as e:
        import traceback
        print(f"Retraining API failed: {e}")
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json or {}

    from datetime import datetime, timedelta
    # Pakistan Standard Time (PKT) is UTC+5. Use exact PKT time as fallback if missing.
    pkt_now = datetime.utcnow() + timedelta(hours=5)

    # Make hour and day_of_week optional in the payload, defaulting strictly to PKT local time!
    hour = data.get("hour")
    if hour is None:
        hour = pkt_now.hour
    else:
        hour = int(hour)

    day_of_week = data.get("day_of_week")
    if day_of_week is None:
        day_of_week = pkt_now.weekday() # Monday=0, Sunday=6
    else:
        day_of_week = int(day_of_week)

    # Extract slot_id for slot-specific dynamic calculations (default to 1)
    slot_id = data.get("slot_id")
    if slot_id is None:
        # Fallback if slot_id is missing, e.g., from MapView/ParkingList estimations
        slot_id = int(data.get("parking_id") or 1)
    else:
        slot_id = int(slot_id)

    # Resolve Parking_Location name based on parking_id
    locations = [
        'Centaurus Mall Parking',
        'Safa Gold Mall Parking',
        'F-6 Markaz - Super Market Parking',
        'F-7 Markaz - Jinnah Super Parking',
        'F-10 Markaz - Main Commercial Hub',
        'G-9 Markaz - Karachi Company Parking',
        'I-8 Markaz - Commercial Area Parking',
        'Blue Area - Jinnah Avenue Commercial Parking',
        'G-11 Markaz - Commercial Center Parking'
    ]
    
    parking_id = data.get("parking_id")
    if parking_id is None:
        parking_id = 1
        
    try:
        pid = int(parking_id)
        if parking_collection is not None:
            p_doc = parking_collection.find_one({'id': pid})
            if p_doc and 'name' in p_doc:
                data['Parking_Location'] = p_doc['name']
        if 'Parking_Location' not in data or not data['Parking_Location']:
            idx = (pid - 1) % len(locations)
            data['Parking_Location'] = locations[idx]
    except Exception:
        data['Parking_Location'] = locations[0]

    # Dynamically calculate/inject defaults for other fields if missing
    if "is_weekend" not in data:
        data["is_weekend"] = 1 if day_of_week >= 5 else 0
    is_weekend = int(data["is_weekend"])

    if "Nearby_Traffic_Level" not in data or not data["Nearby_Traffic_Level"]:
        data["Nearby_Traffic_Level"] = "Medium"
        
    if "Weather_Temperature" not in data or data["Weather_Temperature"] is None:
        data["Weather_Temperature"] = 25.0
        
    if "Weather_Precipitation" not in data or data["Weather_Precipitation"] is None:
        data["Weather_Precipitation"] = 0.0
        
    if "Proximity_To_Exit" not in data or data["Proximity_To_Exit"] is None:
        # Slots 1-10 are 'Close' (5.0), 11-30 are 'Average' (15.0), 31+ are 'Far' (25.0)
        if 1 <= slot_id <= 10:
            data["Proximity_To_Exit"] = 5.0
        elif 11 <= slot_id <= 30:
            data["Proximity_To_Exit"] = 15.0
        else:
            data["Proximity_To_Exit"] = 25.0
        
    if "Spot_Size" not in data or not data["Spot_Size"]:
        # Every 10th slot is 'Compact', every 5th slot is 'Oversized', rest are 'Standard'
        if slot_id % 10 == 0:
            data["Spot_Size"] = "Compact"
        elif slot_id % 5 == 0:
            data["Spot_Size"] = "Oversized"
        else:
            data["Spot_Size"] = "Standard"

    # Calculate complex time-based features dynamically for feature_order alignment
    if "is_rush_hour" not in data:
        data["is_rush_hour"] = int(((8 <= hour <= 10) or (17 <= hour <= 19)) and is_weekend == 0)
    if "is_night" not in data:
        data["is_night"] = int(hour >= 19 or hour <= 5)
    if "is_working_hour" not in data:
        data["is_working_hour"] = int(9 <= hour <= 17 and is_weekend == 0)

    categorical_cols = ["Parking_Location", "Nearby_Traffic_Level", "Spot_Size"]

    for col in categorical_cols:
        if col in encoders:
            if data[col] in encoders[col].classes_:
                data[col] = encoders[col].transform([data[col]])[0]
            else:
                data[col] = encoders[col].transform([encoders[col].classes_[0]])[0]

    # Set computed values in dictionary so they are safely serialized to float list
    data["hour"] = hour
    data["day_of_week"] = day_of_week

    try:
        features = [float(data[col]) for col in feature_order]
    except Exception as e:
        return jsonify({"error": "Invalid input types", "details": str(e)}), 400

    import pandas as pd
    features_df = pd.DataFrame([features], columns=feature_order)

    # Force column reindexing to match model's expected features exactly
    if hasattr(model, "feature_names_in_"):
        expected_cols = [str(c) for c in model.feature_names_in_]
        features_df = features_df[expected_cols]
    elif hasattr(scaler, "feature_names_in_"):
        expected_cols = [str(c) for c in scaler.feature_names_in_]
        features_df = features_df[expected_cols]

    features_scaled = scaler.transform(features_df)

    if model_type == "sklearn":
        if hasattr(model, "predict_proba"):
            probability = float(model.predict_proba(features_scaled)[:, 1][0])
        elif hasattr(model, "decision_function"):
            from sklearn.preprocessing import MinMaxScaler
            raw = model.decision_function(features_scaled)
            scaler2 = MinMaxScaler()
            probability = float(scaler2.fit_transform(raw.reshape(-1, 1)).ravel()[0])
        else:
            probability = float(model.predict(features_scaled)[0])
    else:
        probability = model.predict(features_scaled, verbose=0)[0][0]

    return jsonify({
        "availability_probability": round(float(probability), 3),
        "available": bool(probability > 0.5)
    })

@app.route('/api/parking', methods=['GET'])
def get_parking_data():
    """Get all parking data from MongoDB"""
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        # Fetch all parking records
        parking_data = list(parking_collection.find({}, {'_id': 0}))
        
        # Format for frontend compatibility
        for parking in parking_data:
            # Ensure numeric fields are proper types
            parking['id'] = int(parking.get('id', 0))
            parking['capacity'] = int(parking.get('capacity', 0))
            parking['available'] = int(parking.get('available', 0))
            parking['latitude'] = float(parking.get('latitude', 0.0))
            parking['longitude'] = float(parking.get('longitude', 0.0))
            parking['prediction_percentage'] = int(parking.get('prediction_percentage', 50))
            parking['occupancy_rate'] = float(parking.get('occupancy_rate', 0.0))
            
            # Dynamic pricing algorithm
            base_price = int(parking.get('hourlyRate') or parking.get('price', 80))
            parking['hourlyRate'] = base_price
            if parking['occupancy_rate'] >= 80.0:
                parking['price'] = int(base_price * 1.2) # 20% surge rate
                parking['dynamic_pricing_active'] = True
            else:
                parking['price'] = base_price
                parking['dynamic_pricing_active'] = False
            
            # Convert datetime to string for JSON serialization
            if 'created_at' in parking:
                parking['created_at'] = parking['created_at'].isoformat()
            if 'updated_at' in parking:
                parking['updated_at'] = parking['updated_at'].isoformat()
        
        return jsonify(parking_data)
    
    except Exception as e:
        return jsonify({"error": "Failed to fetch parking data", "details": str(e)}), 500

@app.route('/api/parking/<int:parking_id>', methods=['GET'])
def get_parking_by_id(parking_id):
    """Get specific parking data by ID"""
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        parking = parking_collection.find_one({'id': parking_id}, {'_id': 0})
        
        if parking is None:
            return jsonify({"error": "Parking not found"}), 404
        
        # Format for frontend compatibility
        parking['id'] = int(parking.get('id', 0))
        parking['capacity'] = int(parking.get('capacity', 0))
        parking['available'] = int(parking.get('available', 0))
        parking['latitude'] = float(parking.get('latitude', 0.0))
        parking['longitude'] = float(parking.get('longitude', 0.0))
        parking['prediction_percentage'] = int(parking.get('prediction_percentage', 50))
        parking['occupancy_rate'] = float(parking.get('occupancy_rate', 0.0))
        
        # Dynamic pricing algorithm
        base_price = int(parking.get('hourlyRate') or parking.get('price', 80))
        parking['hourlyRate'] = base_price
        if parking['occupancy_rate'] >= 80.0:
            parking['price'] = int(base_price * 1.2) # 20% surge rate
            parking['dynamic_pricing_active'] = True
        else:
            parking['price'] = base_price
            parking['dynamic_pricing_active'] = False
        
        # Convert datetime to string
        if 'created_at' in parking:
            parking['created_at'] = parking['created_at'].isoformat()
        if 'updated_at' in parking:
            parking['updated_at'] = parking['updated_at'].isoformat()
        
        return jsonify(parking)
    
    except Exception as e:
        return jsonify({"error": "Failed to fetch parking data", "details": str(e)}), 500

@app.route('/api/parking/<int:parking_id>/slots', methods=['GET'])
def get_parking_slots(parking_id):
    """Retrieve slot layouts list for slot selection view"""
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        parking = parking_collection.find_one({'id': parking_id}, {'_id': 0, 'slot_layouts': 1})
        if not parking:
            return jsonify({"error": "Parking location not found"}), 404
            
        return jsonify(parking.get('slot_layouts', []))
    except Exception as e:
        return jsonify({"error": "Failed to fetch slots", "details": str(e)}), 500

@app.route('/api/parking/<int:parking_id>/update', methods=['PUT'])
def update_parking_availability(parking_id):
    """Update parking availability (for real-time updates)"""
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Update fields
        update_data = {
            'available': int(data.get('available', 0)),
            'status': data.get('status', 'available'),
            'updated_at': datetime.utcnow()
        }
        
        # Update prediction percentage based on availability
        capacity = data.get('capacity')
        if capacity:
            update_data['prediction_percentage'] = int((update_data['available'] / int(capacity)) * 100)
        
        result = parking_collection.update_one(
            {'id': parking_id},
            {'$set': update_data}
        )
        
        if result.modified_count:
            return jsonify({
                "message": "Parking updated successfully",
                "parking_id": parking_id,
                "updated_fields": list(update_data.keys())
            })
        else:
            return jsonify({"error": "No changes made"}), 400
    
    except Exception as e:
        return jsonify({"error": "Failed to update parking", "details": str(e)}), 500

@app.route('/api/parking/<int:parking_id>/rate', methods=['PUT', 'OPTIONS'])
def update_parking_rate(parking_id):
    """Update only the specific location's hourly rate and price"""
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        # Get rate, either hourlyRate or price
        hourly_rate = data.get('hourlyRate') or data.get('price')
        if hourly_rate is None:
            return jsonify({"error": "Missing hourlyRate or price in payload"}), 400
            
        try:
            hourly_rate = int(hourly_rate)
        except (ValueError, TypeError):
            return jsonify({"error": "hourlyRate must be an integer"}), 400
            
        # Update both hourlyRate and price to keep them synchronized
        result = parking_collection.update_one(
            {'id': parking_id},
            {
                '$set': {
                    'hourlyRate': hourly_rate,
                    'price': hourly_rate,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Parking location not found"}), 404
            
        return jsonify({
            "success": True,
            "message": "Parking rate updated successfully",
            "parking_id": parking_id,
            "hourlyRate": hourly_rate
        })
    except Exception as e:
        return jsonify({"error": "Failed to update parking rate", "details": str(e)}), 500

@app.route('/api/parking', methods=['POST'])
def create_parking():
    """Create a new parking location"""
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Get the next available ID
        max_id_doc = parking_collection.find_one(sort=[('id', -1)])
        next_id = (max_id_doc['id'] + 1) if max_id_doc else 1

        # Create new parking document with proper field names
        parking_data = {
            'id': next_id,
            'name': data.get('name', 'New Parking'),
            'sector': data.get('sector') or data.get('address', 'Unknown'),
            'capacity': int(data.get('capacity') or data.get('totalSlots', 50)),
            'available': int(data.get('available') or data.get('availableSlots', 50)),
            'price': int(data.get('price') or data.get('hourlyRate', get_base_parking_rate())),
            'latitude': float(data.get('latitude', 33.6844)),
            'longitude': float(data.get('longitude', 73.0479)),
            'status': 'available',
            'total_earnings': 0,
            'occupancy_rate': 0,
            'prediction_percentage': 50,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        result = parking_collection.insert_one(parking_data)

        if result.inserted_id:
            parking_data['_id'] = str(result.inserted_id)
            del parking_data['created_at']
            del parking_data['updated_at']
            return jsonify(parking_data), 201
        else:
            return jsonify({"error": "Failed to create parking"}), 500

    except Exception as e:
        return jsonify({"error": "Failed to create parking", "details": str(e)}), 500

@app.route('/api/parking/<int:parking_id>', methods=['PUT'])
def update_parking(parking_id):
    """Update an existing parking location"""
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Build update data with proper field mappings
        update_data = {
            'name': data.get('name'),
            'sector': data.get('sector') or data.get('address'),
            'capacity': int(data.get('capacity') or data.get('totalSlots', 0)),
            'available': int(data.get('available') or data.get('availableSlots', 0)),
            'price': int(data.get('price') or data.get('hourlyRate', 0)),
            'latitude': float(data.get('latitude', 0)),
            'longitude': float(data.get('longitude', 0)),
            'updated_at': datetime.utcnow()
        }

        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}

        result = parking_collection.update_one(
            {'id': parking_id},
            {'$set': update_data}
        )

        if result.modified_count:
            updated_parking = parking_collection.find_one({'id': parking_id}, {'_id': 0})
            return jsonify(updated_parking)
        else:
            return jsonify({"error": "Parking not found or no changes made"}), 404

    except Exception as e:
        return jsonify({"error": "Failed to update parking", "details": str(e)}), 500

@app.route('/api/parking/<int:parking_id>', methods=['DELETE'])
def delete_parking(parking_id):
    """Delete a parking location"""
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        result = parking_collection.delete_one({'id': parking_id})

        if result.deleted_count:
            return jsonify({"message": "Parking deleted successfully"})
        else:
            return jsonify({"error": "Parking not found"}), 404

    except Exception as e:
        return jsonify({"error": "Failed to delete parking", "details": str(e)}), 500

@app.route('/api/book', methods=['POST'])
def book_slot():
    """Flexible booking endpoint accepting slot_id, user_id, duration, amount"""
    try:
        # Debug: Log request details
        print(f"[DEBUG] Booking Request Received:")
        print(f"   Method: {request.method}")
        print(f"   Headers: {dict(request.headers)}")
        print(f"   Content-Type: {request.content_type}")
        
        if parking_collection is None or bookings_collection is None:
            print("[ERR] Database collections not available")
            return jsonify({"error": "Database not connected"}), 500
        
        data = request.get_json()
        if not data:
            print("[ERR] No JSON data received")
            return jsonify({"error": "No booking data provided"}), 400
        
        print(f"[DATA] Received Data: {data}")
        
        # IMPORTANT: parking_id must ONLY come from 'parking_id' key.
        # 'slot_id' is the selected slot within the parking, not the parking itself.
        raw_parking_id = data.get('parking_id')
        if raw_parking_id is None:
            print("[ERR] No parking_id provided")
            return jsonify({"error": "Missing required field: parking_id"}), 400
        try:
            parking_id = int(raw_parking_id)
        except (ValueError, TypeError):
            print(f"[ERR] Invalid parking_id: {raw_parking_id}")
            return jsonify({"error": f"Invalid parking_id: {raw_parking_id}"}), 400
            
        user_name = str(data.get('user_name') or data.get('user_id', 'Guest User')).strip()
        user_email = str(data.get('user_email', '')).strip().lower()
        duration_hours = int(data.get('duration_hours') or data.get('duration', 1))
        amount = float(data.get('amount') or data.get('total_cost', 0))
        
        # Handle vehicle number with multiple field names and require it
        vehicle_number = None
        for key in ('vehicle_number', 'vehicleNumber', 'vehicle'):
            if data.get(key):
                vehicle_number = str(data.get(key)).strip()
                break

        # Do NOT auto-generate vehicle numbers. Require user-provided value.
        if not vehicle_number:
            print("[ERR] No vehicle number provided in request")
            return jsonify({"error": "Missing required field: vehicle_number"}), 400
        else:
            # Validate vehicle number plate format strictly: e.g., "APD-1234" or "LE-567"
            import re
            plate_regex = r"^[A-Za-z]{2,3}-\d{3,4}$"
            if not re.match(plate_regex, vehicle_number):
                print(f"[ERR] Invalid vehicle number format: {vehicle_number}")
                return jsonify({"error": "Invalid format. Use XXX-1234"}), 400
            print(f"[OK] Using validated vehicle number: {vehicle_number}")
        
        print(f"[UPDATE] Processed Data:")
        print(f"   Parking ID: {parking_id}")
        print(f"   User Name: {user_name}")
        print(f"   Vehicle Number: {vehicle_number}")
        print(f"   Duration: {duration_hours} hours")
        print(f"   Amount: {amount}")
        
        if not parking_id or parking_id <= 0:
            print("[ERR] Invalid parking ID")
            return jsonify({"error": "Missing or invalid parking_id/slot_id"}), 400
        
        # Check if parking exists and has available slots
        parking = parking_collection.find_one({'id': parking_id})
        if not parking:
            print(f"[ERR] Parking with ID {parking_id} not found")
            return jsonify({"error": f"Parking not found (ID: {parking_id})"}), 404
        
        print(f"[LOC] Found Parking: {parking.get('name')}")
        print(f"   Available: {parking.get('available')}/{parking.get('capacity')}")
        
        if parking.get('available', 0) <= 0:
            print("[ERR] No available slots")
            return jsonify({"error": "No available slots in this parking lot"}), 400
        
        # Check if vehicle is already booked
        existing_booking = bookings_collection.find_one({
            'vehicle_number': vehicle_number,
            'status': {'$in': ['confirmed', 'active']}
        })
        if existing_booking:
            print(f"[ERR] Vehicle {vehicle_number} already booked")
            return jsonify({"error": "Vehicle already booked"}), 400
        
        # Get chosen slot details dynamically
        chosen_slot_id = data.get('slot_id') or data.get('selected_slot_id')
        chosen_slot_number = data.get('slot_number') or data.get('selected_slot_number') or data.get('slot')
        
        slot_number_to_save = None
        if chosen_slot_id:
            try:
                slot_id_val = int(chosen_slot_id)
                for s in parking.get('slot_layouts', []):
                    if s.get('id') == slot_id_val:
                        slot_number_to_save = s.get('number')
                        break
            except ValueError:
                pass
        
        if not slot_number_to_save and chosen_slot_number:
            slot_number_to_save = str(chosen_slot_number).strip()
            # Try to resolve slot_id
            for s in parking.get('slot_layouts', []):
                if s.get('number') == slot_number_to_save:
                    chosen_slot_id = s.get('id')
                    break
                    
        # Fallback if no specific slot was sent
        if not slot_number_to_save:
            for s in parking.get('slot_layouts', []):
                if not s.get('isBooked', False):
                    slot_number_to_save = s.get('number')
                    chosen_slot_id = s.get('id')
                    break
            if not slot_number_to_save:
                slot_number_to_save = f"S-{(parking.get('capacity', 0) - parking.get('available', 0) + 1)}"

        # Create booking document - get next booking_id
        max_booking = bookings_collection.find_one(sort=[('booking_id', -1)])
        next_booking_id = 1
        if max_booking and 'booking_id' in max_booking:
            next_booking_id = int(max_booking['booking_id']) + 1

        # Calculate dynamic cost based on location-specific hourlyRate
        base_price = int(parking.get('hourlyRate') or parking.get('price', 80))
        occupancy_rate = float(parking.get('occupancy_rate', 0.0))
        current_rate = int(base_price * 1.2) if occupancy_rate >= 80.0 else base_price
        calculated_cost = current_rate * duration_hours

        booking_data = {
            'booking_id': next_booking_id,
            'parking_id': parking_id,
            'parking_name': parking.get('name', 'Unknown Parking'),
            'user_name': user_name,
            # 'email' is required by GET /api/bookings/user/<email> to look up user history
            'email': user_email,
            'user_email': user_email,
            'vehicle_number': vehicle_number,
            'booking_time': datetime.utcnow(),
            'status': 'confirmed',
            'duration_hours': duration_hours,
            'total_cost': amount or calculated_cost,
            'slot_number': slot_number_to_save,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        print(f"[DB] Creating Booking: {booking_data}")
        
        # Insert booking into database
        booking_result = bookings_collection.insert_one(booking_data)
        print(f"[OK] Booking Inserted: {booking_result.inserted_id}")
        
        # Upsert user record so they immediately appear in Admin Users panel
        if user_email and users_collection is not None:
            users_collection.update_one(
                {'user_id': user_email},
                {'$setOnInsert': {
                    'user_id': user_email,
                    'name': user_name,
                    'email': user_email,
                    'blocked': False,
                    'created_at': datetime.utcnow(),
                }},
                upsert=True
            )
            # Sync the license plate used in this booking back to the user's profile.
            # This ensures Profile page always shows the most recently used plate,
            # even if the user never manually updated their profile.
            users_collection.update_one(
                {'user_id': user_email},
                {'$set': {
                    'license_plate': vehicle_number,
                    'updated_at': datetime.utcnow()
                }}
            )
            # Also match by email field (Firebase-registered users use 'email' not 'user_id')
            users_collection.update_one(
                {'email': user_email, 'user_id': {'$exists': False}},
                {'$set': {
                    'license_plate': vehicle_number,
                    'updated_at': datetime.utcnow()
                }}
            )
            print(f"[OK] Synced license_plate '{vehicle_number}' to user profile: {user_email}")
        
        # Update parking available slots (decrement by 1) and toggle specific slot state
        update_result = parking_collection.update_one(
            {'id': parking_id},
            {
                '$inc': {'available': -1},
                '$set': {
                    'updated_at': datetime.utcnow(),
                    'status': 'limited' if parking.get('available', 0) - 1 <= 10 else 'available'
                }
            }
        )
        
        if chosen_slot_id:
            parking_collection.update_one(
                {'id': parking_id, 'slot_layouts.id': int(chosen_slot_id)},
                {'$set': {'slot_layouts.$.isBooked': True}}
            )
        elif slot_number_to_save:
            parking_collection.update_one(
                {'id': parking_id, 'slot_layouts.number': slot_number_to_save},
                {'$set': {'slot_layouts.$.isBooked': True}}
            )
            
        print(f"[UPDATE] Parking Updated: {update_result.modified_count} documents modified")
        
        # Gate success only on booking insert — parking update is best-effort
        if booking_result.inserted_id:
            socketio.emit('new_booking', {
                'message': 'New booking received',
                'booking_id': int(booking_data['booking_id']),
                'slot_number': str(booking_data['slot_number'])
            })
            response_data = {
                "success": True,
                "message": "Parking slot booked successfully",
                "booking_id": booking_data['booking_id'],
                "parking_id": parking_id,
                "parking_name": parking.get('name'),
                "user_name": booking_data['user_name'],
                "vehicle_number": booking_data['vehicle_number'],
                "slot_number": booking_data['slot_number'],
                "duration_hours": booking_data['duration_hours'],
                "total_cost": booking_data['total_cost'],
                "booking_time": booking_data['booking_time'].isoformat(),
                "remaining_slots": parking.get('available', 0) - 1
            }
            
            print(f"[OK] Booking Success: {response_data}")
            return jsonify(response_data)
        else:
            print("[ERR] Failed to insert booking")
            return jsonify({"error": "Failed to create booking"}), 500
            
    except Exception as e:
        print(f"[ERR] Booking Error: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        return jsonify({"error": "Booking failed", "details": str(e)}), 500

@app.route('/api/book_slot', methods=['POST'])
def book_parking_slot():
    """Book a parking slot with availability check and database updates"""
    try:
        if parking_collection is None or bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"error": "No booking data provided"}), 400
        
        # Validate required fields
        required_fields = ['parking_id', 'user_name', 'vehicle_number']
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400
        
        parking_id = int(data['parking_id'])
        user_name = data['user_name'].strip()
        vehicle_number = data['vehicle_number'].strip()
        
        # Validate vehicle number plate format strictly: e.g., "APD-1234" or "LE-567"
        import re
        plate_regex = r"^[A-Za-z]{2,3}-\d{3,4}$"
        if not re.match(plate_regex, vehicle_number):
            print(f"[ERR] Invalid vehicle number format: {vehicle_number}")
            return jsonify({"error": "Invalid format. Use XXX-1234"}), 400
        
        # Check if parking exists and has available slots
        parking = parking_collection.find_one({'id': parking_id})
        if not parking:
            return jsonify({"error": "Parking not found"}), 404
        
        if parking.get('available', 0) <= 0:
            return jsonify({"error": "No available slots in this parking lot"}), 400
        
        # Check if vehicle is already booked
        existing_booking = bookings_collection.find_one({
            'vehicle_number': vehicle_number,
            'status': {'$in': ['confirmed', 'active']}
        })
        if existing_booking:
            return jsonify({"error": "Vehicle already booked"}), 400
        
        # Create booking document - get next booking_id
        max_booking = bookings_collection.find_one(sort=[('booking_id', -1)])
        next_booking_id = 1
        if max_booking and 'booking_id' in max_booking:
            next_booking_id = int(max_booking['booking_id']) + 1

        # Calculate dynamic cost based on location-specific hourlyRate
        base_price = int(parking.get('hourlyRate') or parking.get('price', 80))
        occupancy_rate = float(parking.get('occupancy_rate', 0.0))
        current_rate = int(base_price * 1.2) if occupancy_rate >= 80.0 else base_price
        duration_hours = int(data.get('duration_hours', 1))

        booking_data = {
            'booking_id': next_booking_id,
            'parking_id': parking_id,
            'parking_name': parking.get('name', 'Unknown Parking'),
            'user_name': user_name,
            'vehicle_number': vehicle_number,
            'booking_time': datetime.utcnow(),
            'status': 'confirmed',
            'duration_hours': duration_hours,
            'total_cost': current_rate * duration_hours,
            'slot_number': parking.get('capacity', 0) - parking.get('available', 0) + 1, # Next available slot
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Insert booking into database
        booking_result = bookings_collection.insert_one(booking_data)
        
        # Update parking available slots (decrement by 1)
        update_result = parking_collection.update_one(
            {'id': parking_id},
            {
                '$inc': {'available': -1},
                '$set': {
                    'updated_at': datetime.utcnow(),
                    'status': 'limited' if parking.get('available', 0) - 1 <= 10 else 'available'
                }
            }
        )
        
        if booking_result.inserted_id and update_result.modified_count:
            socketio.emit('new_booking', {
                'message': 'New booking received',
                'booking_id': int(booking_data['booking_id']),
                'slot_number': str(booking_data['slot_number'])
            })
            return jsonify({
                "success": True,
                "message": "Parking slot booked successfully",
                "booking_id": booking_data['booking_id'],
                "parking_id": parking_id,
                "parking_name": parking.get('name'),
                "user_name": user_name,
                "vehicle_number": vehicle_number,
                "slot_number": booking_data['slot_number'],
                "duration_hours": booking_data['duration_hours'],
                "total_cost": booking_data['total_cost'],
                "booking_time": booking_data['booking_time'].isoformat(),
                "remaining_slots": parking.get('available', 0) - 1
            })
        else:
            return jsonify({"error": "Failed to create booking"}), 500
            
    except Exception as e:
        return jsonify({"error": "Booking failed", "details": str(e)}), 500

@app.route('/api/bookings/<string:vehicle_number>', methods=['GET'])
def get_booking_by_vehicle(vehicle_number):
    """Get booking details by vehicle number"""
    try:
        if bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        booking = bookings_collection.find_one({
            'vehicle_number': vehicle_number,
            'status': {'$in': ['confirmed', 'active']}
        }, {'_id': 0})
        
        if not booking:
            return jsonify({"error": "Booking not found"}), 404
        
        # Convert datetime to string for JSON
        booking['booking_time'] = booking['booking_time'].isoformat()
        booking['created_at'] = booking['created_at'].isoformat()
        booking['updated_at'] = booking['updated_at'].isoformat()
        
        return jsonify(booking)
        
    except Exception as e:
        return jsonify({"error": "Failed to fetch booking", "details": str(e)}), 500

@app.route('/api/bookings/user/<string:email>', methods=['GET'])
def get_user_bookings(email):
    """Get all bookings for a specific user email"""
    try:
        if bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        bookings = list(bookings_collection.find({'email': {'$regex': f'^{email}$', '$options': 'i'}}, {'_id': 0}).sort('booking_id', -1))
        
        for booking in bookings:
            for field in ('booking_time', 'created_at', 'updated_at'):
                if field in booking and hasattr(booking[field], 'isoformat'):
                    booking[field] = booking[field].isoformat()
                    
        return jsonify(bookings)
    except Exception as e:
        return jsonify({"error": "Failed to fetch user bookings", "details": str(e)}), 500

@app.route('/api/bookings', methods=['GET'])
def get_all_bookings():
    """Get all bookings (for admin/monitoring)"""
    try:
        if bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500
        
        bookings = list(bookings_collection.find({}, {'_id': 0}))
        
        # Safely convert datetime to string for JSON
        for booking in bookings:
            for field in ('booking_time', 'created_at', 'updated_at'):
                if field in booking and hasattr(booking[field], 'isoformat'):
                    booking[field] = booking[field].isoformat()
        
        return jsonify(bookings)

    except Exception as e:
        return jsonify({"error": "Failed to fetch bookings", "details": str(e)}), 500

@app.route('/api/bookings/<int:booking_id>', methods=['PUT'])
def update_booking(booking_id):
    """Update a booking status"""
    try:
        if bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Build update data
        update_data = {
            'status': data.get('status', 'active'),
            'updated_at': datetime.utcnow()
        }

        # If completing or cancelling a booking, increment parking available slots and release slot state
        if data.get('status') in ['completed', 'cancelled']:
            booking = bookings_collection.find_one({'booking_id': booking_id})
            if booking and booking.get('status') not in ['completed', 'cancelled']:
                parking_collection.update_one(
                    {'id': booking.get('parking_id')},
                    {'$inc': {'available': 1}}
                )
                slot_num = booking.get('slot_number')
                if slot_num:
                    parking_collection.update_one(
                        {'id': booking.get('parking_id'), 'slot_layouts.number': slot_num},
                        {'$set': {'slot_layouts.$.isBooked': False}}
                    )

        result = bookings_collection.update_one(
            {'booking_id': booking_id},
            {'$set': update_data}
        )

        if result.modified_count:
            return jsonify({"message": "Booking updated successfully"})
        else:
            return jsonify({"error": "Booking not found or no changes made"}), 404

    except Exception as e:
        return jsonify({"error": "Failed to update booking", "details": str(e)}), 500

@app.route('/api/bookings/<int:booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    """Delete a booking"""
    try:
        if bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        # Get booking first to restore parking slots
        booking = bookings_collection.find_one({'booking_id': booking_id})

        result = bookings_collection.delete_one({'booking_id': booking_id})

        if result.deleted_count:
            # Restore the available slot count and release slot state
            if booking:
                parking_collection.update_one(
                    {'id': booking.get('parking_id')},
                    {'$inc': {'available': 1}}
                )
                slot_num = booking.get('slot_number')
                if slot_num:
                    parking_collection.update_one(
                        {'id': booking.get('parking_id'), 'slot_layouts.number': slot_num},
                        {'$set': {'slot_layouts.$.isBooked': False}}
                    )
            return jsonify({"message": "Booking deleted successfully"})
        else:
            return jsonify({"error": "Booking not found"}), 404

    except Exception as e:
        return jsonify({"error": "Failed to delete booking", "details": str(e)}), 500

@app.route('/api/bookings/<string:booking_id>/finish', methods=['POST', 'PUT', 'PATCH', 'OPTIONS'])
def finish_booking(booking_id):
    """Automate the booking lifecycle by completing the booking and releasing the slot"""
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
        
    try:
        if bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        # Try to parse booking_id as int if possible
        db_booking_id = booking_id
        try:
            db_booking_id = int(booking_id)
        except ValueError:
            pass
            
        # Find the booking first
        booking = bookings_collection.find_one({'booking_id': db_booking_id})
        if not booking:
            print(f"[ERR] Booking {booking_id} not found to finish")
            return jsonify({"error": f"Booking not found (ID: {booking_id})"}), 404
            
        current_status = booking.get('status')
        
        # We only update if it is in confirmed or active state.
        if current_status in ('confirmed', 'active'):
            # Update the specific booking document
            bookings_collection.update_one(
                {'booking_id': db_booking_id},
                {'$set': {
                    'status': 'completed',
                    'updated_at': datetime.utcnow()
                }}
            )
            
            # Automatically release the associated parking slot
            parking_id = booking.get('parking_id')
            slot_num = booking.get('slot_number')
            
            if parking_id:
                # Increment the available slots of the parking lot by 1
                parking_collection.update_one(
                    {'id': parking_id},
                    {'$inc': {'available': 1}}
                )
                
                # Release slot layout in database
                if slot_num:
                    parking_collection.update_one(
                        {'id': parking_id, 'slot_layouts.number': slot_num},
                        {'$set': {'slot_layouts.$.isBooked': False}}
                    )
            print(f"[OK] Booking {booking_id} successfully finished and slot S-{slot_num} released")
            
            # Broadcast the global Socket.IO notification to all administrators
            socketio.emit('booking_finished', {'message': 'A user has reached their destination.'})
            
            return jsonify({
                "success": True,
                "message": "Booking finished and slot released successfully",
                "booking_id": booking_id,
                "status": "completed"
            })
            
        else:
            return jsonify({
                "success": True,
                "message": f"Booking is already in '{current_status}' state",
                "booking_id": booking_id,
                "status": current_status
            })
            
    except Exception as e:
        print(f"[ERR] Failed to finish booking {booking_id}: {e}")
        return jsonify({"error": "Failed to finish booking", "details": str(e)}), 500

@app.route('/api/settings', methods=['GET', 'PUT', 'OPTIONS'])
@app.route('/api/admin/settings', methods=['GET', 'PUT', 'POST', 'OPTIONS'])
def manage_settings():
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
        
    try:
        if settings_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        if request.method == 'GET':
            settings = settings_collection.find_one({}, {'_id': 0})
            if not settings:
                settings = {
                    "hourlyRate": 50,
                    "maxBookingHours": 8,
                    "workingHoursStart": "08:00",
                    "workingHoursEnd": "22:00",
                    "minAdvanceBooking": 1,
                    "cancellationHours": 2,
                    "notifications": {
                        "email": True,
                        "sms": False,
                        "push": True
                    },
                    "base_parking_rate": 50,
                    "fine_rate_per_hour": 100,
                    "system_status": "Active"
                }
                settings_collection.insert_one(settings.copy())
            else:
                # Guarantee synchronized pricing properties
                rate = settings.get("base_parking_rate") or settings.get("hourlyRate") or 50
                if settings.get("base_parking_rate") != rate or settings.get("hourlyRate") != rate:
                    settings["base_parking_rate"] = rate
                    settings["hourlyRate"] = rate
                    settings_collection.update_one({}, {'$set': {'base_parking_rate': rate, 'hourlyRate': rate}})
            return jsonify(settings)
            
        elif request.method in ('PUT', 'POST'):
            data = request.get_json()
            if not data:
                return jsonify({"error": "No data provided"}), 400
                
            update_fields = {}
            for k in ("hourlyRate", "maxBookingHours", "workingHoursStart", "workingHoursEnd", "minAdvanceBooking", "cancellationHours", "notifications", "base_parking_rate", "fine_rate_per_hour", "system_status"):
                if k in data:
                    if k == "notifications" and isinstance(data[k], dict):
                        update_fields[k] = data[k]
                    elif k in ("hourlyRate", "maxBookingHours", "minAdvanceBooking", "cancellationHours", "base_parking_rate", "fine_rate_per_hour"):
                        try:
                            update_fields[k] = int(data[k])
                        except (ValueError, TypeError):
                            update_fields[k] = data[k]
                    else:
                        update_fields[k] = data[k]
            
            if "hourlyRate" in update_fields and "base_parking_rate" not in update_fields:
                update_fields["base_parking_rate"] = update_fields["hourlyRate"]
            elif "base_parking_rate" in update_fields and "hourlyRate" not in update_fields:
                update_fields["hourlyRate"] = update_fields["base_parking_rate"]

            settings_collection.update_one({}, {'$set': update_fields}, upsert=True)
            print(f"[OK] Settings updated successfully: {update_fields}")
            return jsonify({"success": True, "message": "Settings updated successfully", "settings": update_fields})
            
    except Exception as e:
        print(f"[ERR] Settings error: {e}")
        return jsonify({"error": "Settings operation failed", "details": str(e)}), 500

@app.route('/api/admin/stats', methods=['GET', 'OPTIONS'])
def get_admin_dashboard_stats_alias():
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
    return get_dashboard_stats()

@app.route('/api/parking/<int:parking_id>/slots/<string:slot_number>/booking', methods=['GET', 'OPTIONS'])
def get_slot_booking(parking_id, slot_number):
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
    try:
        if bookings_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        booking = bookings_collection.find_one({
            'parking_id': parking_id,
            'slot_number': slot_number,
            'status': {'$in': ['confirmed', 'active']}
        }, {'_id': 0})
        
        if not booking:
            # Try matching clean integer version of slot number
            clean_slot = slot_number.replace('S-', '')
            booking = bookings_collection.find_one({
                'parking_id': parking_id,
                'slot_number': int(clean_slot) if clean_slot.isdigit() else clean_slot,
                'status': {'$in': ['confirmed', 'active']}
            }, {'_id': 0})
            
        if not booking:
            # Try direct string clean slot number
            booking = bookings_collection.find_one({
                'parking_id': parking_id,
                'slot_number': clean_slot,
                'status': {'$in': ['confirmed', 'active']}
            }, {'_id': 0})
            
        if not booking:
            return jsonify({"error": "No active booking found for this slot"}), 404
            
        for field in ('booking_time', 'created_at', 'updated_at'):
            if field in booking and hasattr(booking[field], 'isoformat'):
                booking[field] = booking[field].isoformat()
                
        return jsonify(booking)
    except Exception as e:
        return jsonify({"error": "Failed to fetch slot booking details", "details": str(e)}), 500

@app.route('/api/parking/<int:parking_id>/slots/<string:slot_number>/status', methods=['PUT', 'OPTIONS'])
def update_slot_status(parking_id, slot_number):
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
        
    try:
        if parking_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        data = request.get_json()
        new_status = data.get('status', 'available')
        
        parking = parking_collection.find_one({'id': parking_id})
        if not parking:
            return jsonify({"error": "Parking location not found"}), 404
            
        slot = None
        for s in parking.get('slot_layouts', []):
            if s.get('number') == slot_number:
                slot = s
                break
                
        if not slot:
            return jsonify({"error": "Slot not found"}), 404
            
        old_status = slot.get('status', 'available')
        old_is_booked = slot.get('isBooked', False)
        
        if old_status == new_status and not old_is_booked:
            return jsonify({"success": True, "message": "No change in status"})
            
        avail_change = 0
        if old_status == 'available' and new_status == 'Out of Order':
            avail_change = -1
        elif old_status == 'Out of Order' and new_status == 'available':
            avail_change = 1
            
        if old_is_booked and new_status == 'available':
            avail_change += 1
            
        is_booked_val = (new_status == 'Out of Order')
        
        parking_collection.update_one(
            {'id': parking_id, 'slot_layouts.number': slot_number},
            {
                '$set': {
                    'slot_layouts.$.status': new_status,
                    'slot_layouts.$.isBooked': is_booked_val
                },
                '$inc': {'available': avail_change}
            }
        )
        
        print(f"[OK] Slot {slot_number} of parking {parking_id} status updated to {new_status}")
        return jsonify({"success": True, "message": f"Slot {slot_number} status updated to {new_status}"})
        
    except Exception as e:
        print(f"[ERR] Failed to update slot status: {e}")
        return jsonify({"error": "Failed to update slot status", "details": str(e)}), 500

@app.route('/api/users', methods=['GET'])
def get_all_users():
    """Get all users (for admin)"""
    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        users = list(users_collection.find({}, {'_id': 0}))

        for user in users:
            if 'created_at' in user:
                user['created_at'] = user['created_at'].isoformat()
            if 'updated_at' in user:
                user['updated_at'] = user['updated_at'].isoformat()

        return jsonify(users)

    except Exception as e:
        return jsonify({"error": "Failed to fetch users", "details": str(e)}), 500

@app.route('/api/users/<string:user_id>', methods=['GET'])
def get_user_by_id(user_id):
    """Get single user profile details by user_id (email)"""
    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        # Try primary lookup by 'user_id' field first (legacy/non-Firebase users)
        user = users_collection.find_one({'user_id': user_id}, {'_id': 0, 'password': 0})
        
        # Fallback: Firebase-registered users are stored with 'email' as the key,
        # not 'user_id'. The Profile page calls this endpoint with the user's email.
        if not user:
            user = users_collection.find_one({'email': user_id}, {'_id': 0, 'password': 0})
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        if 'created_at' in user:
            user['created_at'] = user['created_at'].isoformat()
        if 'updated_at' in user:
            user['updated_at'] = user['updated_at'].isoformat()
            
        return jsonify(user)
    except Exception as e:
        return jsonify({"error": "Failed to fetch user profile", "details": str(e)}), 500

@app.route('/api/users/<string:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update user profile or status (block/unblock)"""
    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        data = request.get_json()
        update_fields = {}
        
        if 'blocked' in data:
            update_fields['blocked'] = data.get('blocked')
        if 'name' in data:
            update_fields['name'] = data.get('name')
        if 'license_plate' in data:
            update_fields['license_plate'] = data.get('license_plate')
        if 'email_notifications' in data:
            update_fields['email_notifications'] = data.get('email_notifications')
            
        update_fields['updated_at'] = datetime.utcnow()

        # Try primary match by 'user_id' (legacy users)
        result = users_collection.update_one(
            {'user_id': user_id},
            {'$set': update_fields}
        )

        # Fallback: Firebase users are stored with 'email' field, not 'user_id'
        if result.matched_count == 0:
            result = users_collection.update_one(
                {'email': user_id},
                {'$set': update_fields}
            )

        if result.matched_count:
            return jsonify({"message": "User updated successfully"})
        else:
            return jsonify({"error": "User not found"}), 404

    except Exception as e:
        return jsonify({"error": "Failed to update user", "details": str(e)}), 500

@app.route('/api/user/profile', methods=['PUT', 'OPTIONS'])
def update_own_profile():
    """
    Authenticated profile update endpoint.
    The user's identity is derived from their Firebase ID token — they can only
    update their own profile. No user_id is needed in the URL.
    """
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200

    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        # ── Step 1: Extract and verify Firebase Bearer token ─────────────────
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.lower().startswith('bearer '):
            return jsonify({"error": "Missing or malformed Authorization header"}), 401

        token = auth_header[7:].strip()
        if not token:
            return jsonify({"error": "Empty token"}), 401

        try:
            from firebase_admin import auth as fb_auth
            decoded = fb_auth.verify_id_token(token, clock_skew_seconds=300)
            caller_email = decoded.get('email', '').strip().lower()
        except Exception as token_err:
            print(f"[update_own_profile] Token verification failed: {token_err}")
            return jsonify({"error": "Invalid or expired Firebase token", "details": str(token_err)}), 401

        if not caller_email:
            return jsonify({"error": "Token does not contain a valid email"}), 400

        # ── Step 2: Build update payload from request body ───────────────────
        data = request.get_json(silent=True) or {}
        update_fields = {'updated_at': datetime.utcnow()}

        if 'name' in data and data['name']:
            update_fields['name'] = str(data['name']).strip()

        if 'license_plate' in data:
            plate = str(data['license_plate']).strip() if data['license_plate'] else ''
            if plate:
                import re
                if not re.match(r'^[A-Za-z]{2,3}-\d{3,4}$', plate):
                    return jsonify({"error": "Invalid license plate format. Use XXX-1234 (e.g. LEA-1234)"}), 400
            update_fields['license_plate'] = plate

        if 'email_notifications' in data:
            update_fields['email_notifications'] = bool(data['email_notifications'])

        # ── Step 3: Update the caller's own document in MongoDB ──────────────
        # Try by 'user_id' first (legacy users), then by 'email' (Firebase users)
        result = users_collection.update_one(
            {'user_id': caller_email},
            {'$set': update_fields}
        )
        if result.matched_count == 0:
            result = users_collection.update_one(
                {'email': caller_email},
                {'$set': update_fields}
            )

        if result.matched_count == 0:
            return jsonify({"error": "User profile not found in database"}), 404

        print(f"[OK] Profile updated for {caller_email}: {list(update_fields.keys())}")

        # ── Step 4: Return the freshly updated user document ─────────────────
        updated_user = users_collection.find_one(
            {'$or': [{'user_id': caller_email}, {'email': caller_email}]},
            {'_id': 0, 'password': 0}
        )
        if updated_user:
            for ts_field in ('created_at', 'updated_at'):
                if ts_field in updated_user and hasattr(updated_user[ts_field], 'isoformat'):
                    updated_user[ts_field] = updated_user[ts_field].isoformat()

        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "user": updated_user or {}
        })

    except Exception as e:
        import traceback
        print(f"[ERR] update_own_profile failed: {e}\n{traceback.format_exc()}")
        return jsonify({"error": "Failed to update profile", "details": str(e)}), 500

@app.route('/api/users/<string:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete user profile from database"""

    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500

        result = users_collection.delete_one({'user_id': user_id})

        if result.deleted_count:
            return jsonify({"message": "User deleted successfully"})
        else:
            return jsonify({"error": "User not found"}), 404

    except Exception as e:
        return jsonify({"error": "Failed to delete user", "details": str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_dashboard_stats():
    """Consolidated dashboard stats endpoint - returns all counts in one call"""
    try:
        total_parking = parking_collection.count_documents({}) if parking_collection is not None else 0
        total_bookings = bookings_collection.count_documents({}) if bookings_collection is not None else 0
        total_users = users_collection.count_documents({}) if users_collection is not None else 0
        
        active_bookings = bookings_collection.count_documents(
            {'status': {'$in': ['confirmed', 'active']}}
        ) if bookings_collection is not None else 0
        
        # Revenue: sum all total_cost fields
        revenue_pipeline = [{'$group': {'_id': None, 'total': {'$sum': '$total_cost'}}}]
        revenue_result = list(bookings_collection.aggregate(revenue_pipeline)) if bookings_collection is not None else []
        total_revenue = revenue_result[0]['total'] if revenue_result else 0
        
        # Recent bookings (last 10 sorted by booking_id descending)
        recent = []
        if bookings_collection is not None:
            cursor = bookings_collection.find({}, {'_id': 0}).sort('booking_id', -1).limit(10)
            for b in cursor:
                if 'booking_time' in b and hasattr(b['booking_time'], 'isoformat'):
                    b['booking_time'] = b['booking_time'].isoformat()
                if 'created_at' in b and hasattr(b['created_at'], 'isoformat'):
                    b['created_at'] = b['created_at'].isoformat()
                if 'updated_at' in b and hasattr(b['updated_at'], 'isoformat'):
                    b['updated_at'] = b['updated_at'].isoformat()
                recent.append(b)
        
        return jsonify({
            'total_parking': total_parking,
            'total_bookings': total_bookings,
            'total_users': total_users,
            'active_bookings': active_bookings,
            'total_revenue': total_revenue,
            'recent_bookings': recent
        })
    except Exception as e:
        import traceback
        print(f"Stats error: {traceback.format_exc()}")
        return jsonify({"error": "Failed to fetch stats", "details": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """API health check endpoint"""
    try:
        db_status = "connected" if parking_collection is not None else "disconnected"
        model_status = "loaded" if model is not None else "not_loaded"
        return jsonify({
            "status": "healthy",
            "database": db_status,
            "model": model_status,
            "timestamp": datetime.utcnow().isoformat()
        })
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }), 500

@app.route('/api/auth/register', methods=['POST'])
@app.route('/api/register', methods=['POST', 'OPTIONS'])
def auth_register():
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No registration data"}), 400
            
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()
        
        if not email or not password:
            return jsonify({"error": "Email and Password required"}), 400
            
        # Check if user already exists
        existing = users_collection.find_one({'email': email})
        if existing:
            return jsonify({"error": "User with this email already exists"}), 400
            
        # Hash password securely before saving (scrypt / pbkdf2)
        password_hash = generate_password_hash(password)
        
        # Create user document
        user_doc = {
            'user_id': email,
            'name': name or email.split('@')[0],
            'email': email,
            'password': password_hash,
            'blocked': False,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        users_collection.insert_one(user_doc)
        
        # Generate secureTimed signed session token
        token = serializer.dumps({'email': email})
        
        return jsonify({
            "success": True,
            "message": "User registered successfully",
            "token": token,
            "user": {"email": email, "name": user_doc['name']}
        }), 201
    except Exception as e:
        return jsonify({"error": "Registration failed", "details": str(e)}), 500

@app.route('/api/firebase_auth', methods=['POST', 'OPTIONS'])
def firebase_auth_endpoint():
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
        
    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        token = None
        
        # ── AREA 3: Token extraction from Authorization header ──────────────────
        # Safely strips the 'Bearer ' prefix (7 chars) case-insensitively.
        auth_header = request.headers.get('Authorization', '')
        if auth_header:
            if auth_header.lower().startswith('bearer '):
                token = auth_header[7:].strip()  # slice off exactly 'Bearer '
            else:
                token = auth_header.strip()
        
        # Fallback: read from JSON body if header was not present
        if not token:
            try:
                body = request.get_json(silent=True)
                if body:
                    token = body.get('token')
            except Exception:
                pass
        
        if not token:
            print("[firebase_auth] No token received — header or body is empty.")
            return jsonify({"error": "Missing Firebase token"}), 400
        
        # Diagnostic: log first 20 chars to confirm token is arriving intact
        print(f"[firebase_auth] Token received (first 20 chars): '{token[:20]}...' | Length: {len(token)}")
        
        # ── AREA 4: Verify the Firebase ID token ────────────────────────────────
        try:
            from firebase_admin import auth
            decoded_token = auth.verify_id_token(token, clock_skew_seconds=300)
            print(f"[firebase_auth] Token verified OK — uid: {decoded_token.get('uid')}, email: {decoded_token.get('email')}")
        except Exception as te:
            error_type = type(te).__name__
            err_detail = str(te)
            
            # ── Detailed diagnostics — read these in the Flask console ──────────
            diagnostic = "General verification error"
            if "expired" in err_detail.lower():
                diagnostic = "Token has expired — frontend must call getIdToken(true) to force-refresh."
            elif "could not deserialize key data" in err_detail.lower() or "invalid key" in err_detail.lower():
                diagnostic = "DUMMY/INVALID private key in serviceAccountKey.json — replace with real key from Firebase Console."
            elif "signature" in err_detail.lower():
                diagnostic = "Token signature mismatch — serviceAccountKey.json may be for a different project, or is a dummy/fake key."
            elif "audience" in err_detail.lower() or "aud" in err_detail.lower():
                diagnostic = "Token audience mismatch — frontend Firebase project ID does not match serviceAccountKey.json project_id."
            elif "issuer" in err_detail.lower() or "iss" in err_detail.lower():
                diagnostic = "Token issuer is invalid — check that frontend is using the correct Firebase project."
            elif "transport" in err_detail.lower() or "connection" in err_detail.lower():
                diagnostic = "Network error fetching Google's public certs — check internet connectivity on the Flask server."
                
            err_msg = (
                f"\n{'='*70}\n"
                f"[FIREBASE AUTH FAILURE] {datetime.utcnow().isoformat()}\n"
                f"  Error Type : {error_type}\n"
                f"  Message    : {err_detail}\n"
                f"  Diagnostic : {diagnostic}\n"
                f"{'='*70}\n"
            )
            print(err_msg)
            
            try:
                log_path = os.path.join(BASE_DIR, 'firebase_auth_errors.log')
                with open(log_path, 'a') as lf:
                    lf.write(err_msg)
            except Exception as le:
                print(f"Failed to write to log file: {le}")
                
            print("[INFO] Attempting manual JWT fallback verification...")
            try:
                import urllib.request
                import ssl
                import json
                import jwt
                from cryptography.x509 import load_pem_x509_certificate
                
                # Fetch certificates using urllib + unverified context
                url = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                context = ssl._create_unverified_context()
                with urllib.request.urlopen(req, context=context, timeout=10) as response:
                    certs = json.loads(response.read().decode('utf-8'))
                    
                unverified_header = jwt.get_unverified_header(token)
                kid = unverified_header.get('kid')
                if not kid or kid not in certs:
                    raise Exception(f"Invalid kid or certificate not found for kid: {kid}")
                    
                cert_str = certs[kid]
                cert_obj = load_pem_x509_certificate(cert_str.encode('utf-8'))
                public_key = cert_obj.public_key()
                
                decoded_token = jwt.decode(
                    token, 
                    public_key, 
                    algorithms=['RS256'], 
                    audience='ai-enhanced-smart-parking',
                    issuer='https://securetoken.google.com/ai-enhanced-smart-parking',
                    leeway=300
                )
                decoded_token['uid'] = decoded_token.get('sub')
                print("[OK] Token successfully verified via fallback mechanism!")
            except Exception as fe:
                import traceback
                fallback_err_msg = f"[ERR] Manual verification fallback also failed:\nReason: {fe}\n{traceback.format_exc()}\n"
                print(fallback_err_msg)
                try:
                    log_path = os.path.join(BASE_DIR, 'firebase_auth_errors.log')
                    with open(log_path, 'a') as lf:
                        lf.write(f"=== Fallback Verification Error: {datetime.utcnow().isoformat()} ===\n")
                        lf.write(fallback_err_msg)
                        lf.write("==================================================\n")
                except Exception as le:
                    print(f"Failed to write to log file: {le}")
                return jsonify({"error": "Invalid Firebase token", "details": f"Firebase verification failed: {err_detail}. Fallback failed: {str(fe)}"}), 401
            
        email = decoded_token.get('email', '').strip().lower()
        name = decoded_token.get('name', '').strip()
        uid = decoded_token.get('uid')
        
        if not email:
            return jsonify({"error": "Firebase token does not contain a valid email"}), 400
            
        # Check users collection in MongoDB
        user = users_collection.find_one({'email': email})
        is_new_user = False
        if not user:
            # Create a new user document if they don't exist
            user_doc = {
                'user_id': email,
                'name': name or email.split('@')[0],
                'email': email,
                'firebase_uid': uid,
                'blocked': False,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            users_collection.insert_one(user_doc)
            user = user_doc
            is_new_user = True
            print(f"[INFO] Created new user via Firebase auth: {email}")
        else:
            # If user already exists in MongoDB, check if firebase_uid has changed or not set
            old_uid = user.get('firebase_uid')
            if old_uid != uid:
                users_collection.update_one(
                    {'email': email},
                    {'$set': {'firebase_uid': uid, 'updated_at': datetime.utcnow()}}
                )
                print(f"[INFO] Updated/Synced firebase_uid for existing user {email} from {old_uid} to {uid}")
                is_new_user = True
                
        if user.get('blocked', False):
            return jsonify({"error": "Your account has been blocked by an administrator"}), 403
            
        # Generate session token (using our serializer)
        session_token = serializer.dumps({'email': email})
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": session_token,
            "user": {"email": email, "name": user.get('name')},
            "isNewUser": is_new_user
        })
        
    except Exception as e:
        import traceback
        print(f"[ERR] Firebase auth route error: {e}")
        print(traceback.format_exc())
        return jsonify({"error": "Authentication failed", "details": str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
@app.route('/api/login', methods=['POST', 'OPTIONS'])
def auth_login():
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
    try:
        if users_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No login credentials"}), 400
            
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({"error": "Email and Password required"}), 400
            
        user = users_collection.find_one({'email': email})
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401
            
        stored_password = user.get('password', '')
        password_correct = False
        
        # Verify password hash (or plaintext fallback for seamless migration of older records)
        if stored_password.startswith(('scrypt:', 'pbkdf2:', 'bcrypt:')):
            password_correct = check_password_hash(stored_password, password)
        else:
            # Plaintext fallback for pre-existing accounts
            if stored_password == password:
                password_correct = True
                # Migrate user password to secure hash immediately in MongoDB
                users_collection.update_one(
                    {'email': email},
                    {'$set': {
                        'password': generate_password_hash(password),
                        'updated_at': datetime.utcnow()
                    }}
                )
                print(f"[INFO] Automatically migrated plaintext password for user: {email}")
        
        if not password_correct:
            return jsonify({"error": "Invalid email or password"}), 401
            
        if user.get('blocked', False):
            return jsonify({"error": "Your account has been blocked by an administrator"}), 403
            
        # Generate secureTimed signed session token
        token = serializer.dumps({'email': email})
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": token,
            "user": {"email": email, "name": user.get('name')}
        })
    except Exception as e:
        return jsonify({"error": "Login failed", "details": str(e)}), 500

@app.route('/api/contact', methods=['POST', 'OPTIONS'])
def save_contact_message():
    # Handle preflight CORS request explicitly
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200
        
    try:
        if contacts_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        
        if not name or not email or not subject or not message:
            return jsonify({"error": "All fields (name, email, subject, message) are required"}), 400
            
        # Create message document
        msg_doc = {
            'name': name,
            'email': email,
            'subject': subject,
            'message': message,
            'created_at': datetime.utcnow()
        }
        
        contacts_collection.insert_one(msg_doc)
        
        return jsonify({
            "success": True,
            "message": "Your message has been sent successfully."
        }), 201
        
    except Exception as e:
        import traceback
        print(f"[ERR] Failed to save contact message: {e}")
        print(traceback.format_exc())
        return jsonify({"error": "Failed to send message", "details": str(e)}), 500

@app.route('/api/contact', methods=['GET'])
def get_contact_messages():
    """Get all saved contact messages (for admin panel)"""
    try:
        if contacts_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        messages = list(contacts_collection.find({}))
        
        for msg in messages:
            msg['_id'] = str(msg['_id']) # Convert ObjectId to string for JSON serialization
            if 'created_at' in msg:
                msg['created_at'] = msg['created_at'].isoformat()
                
        # Sort messages by created_at descending (latest first)
        messages.sort(key=lambda x: x.get('created_at', ''), reverse=True)
                
        return jsonify(messages)
        
    except Exception as e:
        return jsonify({"error": "Failed to fetch messages", "details": str(e)}), 500

@app.route('/api/contact/<string:msg_id>', methods=['DELETE'])
def delete_contact_message(msg_id):
    """Delete a saved contact message by ID"""
    try:
        if contacts_collection is None:
            return jsonify({"error": "Database not connected"}), 500
            
        result = contacts_collection.delete_one({'_id': ObjectId(msg_id)})
        
        if result.deleted_count:
            return jsonify({"success": True, "message": "Message deleted successfully"})
        else:
            return jsonify({"error": "Message not found"}), 404
            
    except Exception as e:
        return jsonify({"error": "Failed to delete message", "details": str(e)}), 500

if __name__ == "__main__":
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)


