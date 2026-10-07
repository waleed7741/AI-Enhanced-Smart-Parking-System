import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import './MapView.css'
import Toast from '../components/Toast'

const MapComponent = lazy(() => import('../components/MapComponent'))

const MapFallback = () => (
  <div style={{
    flex: 1,
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#0f172a',
    color: '#38bdf8'
  }}>
    <div className="loader">Loading 3D Interactive Map...</div>
  </div>
)

const MapView = () => {
  const navigate = useNavigate()

  const [parkingData, setParkingData] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [showLocationPopup, setShowLocationPopup] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const [predictions, setPredictions] = useState({})
  const [isPredicting, setIsPredicting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'info' })
  const watchIdRef = useRef(null)

  // Calculate availability chance
  const calculateAvailabilityChance = (parking, mlPrediction) => {
    if (!parking.capacity) return 50
    const slotRatio = parking.available / parking.capacity
    const actualPercentage = Math.round(slotRatio * 100)

    if (parking.available === 0) return 0
    if (parking.available >= parking.capacity * 0.8) {
      return Math.min(95, actualPercentage)
    }

    const mlConfidence = mlPrediction ? mlPrediction.confidence : 50
    const combinedChance = Math.round(actualPercentage * 0.7 + mlConfidence * 0.3)

    return Math.min(95, Math.max(5, combinedChance))
  }

  // Dynamic sorted recommendations
  const sortedRecommendations = recommendations
    .map(rec => {
      const prediction = predictions[rec.id]
      const availabilityChance = prediction ? calculateAvailabilityChance(rec, prediction) : 50
      const scaledAvailable = Math.round((availabilityChance / 100) * Math.min(rec.capacity || 100, 350))

      return {
        ...rec,
        availabilityChance,
        rank: 0,
        available: scaledAvailable
      }
    })
    .sort((a, b) => b.availabilityChance - a.availabilityChance)
    .map((rec, index) => ({ ...rec, rank: index + 1 }))

  // Build prediction payload
  const buildPredictionPayload = (parking) => {
    const now = new Date()
    const hour = now.getHours()
    const day_of_week = (now.getDay() + 6) % 7
    const is_weekend = (day_of_week >= 5) ? 1 : 0
    const trafficLevels = ['Low', 'Medium', 'High']
    const traffic = trafficLevels[parking.id % trafficLevels.length]
    const spotSizes = ['Standard', 'Compact', 'Oversized']
    const spot_size = spotSizes[parking.id % spotSizes.length]

    return {
      hour,
      day_of_week,
      is_weekend,
      Nearby_Traffic_Level: traffic,
      Weather_Temperature: 25,
      Weather_Precipitation: 0,
      Proximity_To_Exit: 5,
      Spot_Size: spot_size,
      parking_id: parking.id
    }
  }

  // Predict availability for a parking location
  const predictAvailability = async (parking) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const payload = buildPredictionPayload(parking)
      const response = await fetch(`${apiBase}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const data = await response.json()
        return {
          probability: data.availability_probability,
          available: data.available,
          confidence: Math.round(data.availability_probability * 100)
        }
      }
    } catch (error) {
      console.log('Prediction error, using fallback')
    }
    return { probability: 0.5, available: true, confidence: 50 }
  }

  // Predict for all parking locations
  const predictAllParking = async () => {
    if (parkingData.length === 0) return

    setIsPredicting(true)
    const newPredictions = {}

    for (const parking of parkingData) {
      const prediction = await predictAvailability(parking)
      newPredictions[parking.id] = prediction
    }

    setPredictions(newPredictions)
    setIsPredicting(false)
  }

  // Map initialization and rendering are handled lazily by MapComponent

  // Fetch parking data
  useEffect(() => {
    const fetchParkingData = async (isSilent = false) => {
      if (!isSilent) {
        setLoading(true)
      }
      setError(null)

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

      try {
        const res = await fetch(`${apiBase}/api/parking`)
        if (res.ok) {
          const data = await res.json()
          const parkingList = Array.isArray(data) ? data : data.parking || []
          setParkingData(parkingList)
          setRecommendations(prev => {
            if (prev && prev.length > 0) {
              return parkingList.slice(0, 12).map((p, idx) => ({
                ...p,
                distance: prev[idx]?.distance || (Math.random() * 5 + 1).toFixed(1)
              }))
            }
            return parkingList.slice(0, 12).map(p => ({
              ...p,
              distance: (Math.random() * 5 + 1).toFixed(1)
            }))
          })
        } else {
          throw new Error(`Server returned status ${res.status}`)
        }
      } catch (err) {
        console.error('Error fetching live parking data for MapView:', err)
        if (!isSilent) {
          setError('Failed to load live parking data from the server. Please check if the backend is running.')
        }
      } finally {
        if (!isSilent) {
          setLoading(false)
        }
      }
    }

    fetchParkingData()
    // Poll every 5 seconds silently for real-time map availability updates
    const interval = setInterval(() => fetchParkingData(true), 5000)
    return () => clearInterval(interval)
  }, [])

  // Map markers and AI availability popups are managed dynamically inside MapComponent

  // Live predictions
  useEffect(() => {
    if (parkingData.length === 0) return

    predictAllParking()

    const interval = setInterval(() => {
      predictAllParking()
    }, 60000)

    return () => clearInterval(interval)
  }, [parkingData])

  // Live location tracking
  const enableLiveLocation = () => {
    setShowLocationPopup(false)
    setIsTracking(true)

    if (!navigator.geolocation) {
      setToast({ message: 'Geolocation not supported', type: 'warning' })
      return
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation({ lat: latitude, lng: longitude })
      },
      (error) => {
        console.error('Location error:', error)
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
    )
  }

  // User location marker tracking is handled inside MapComponent

  // Cleanup
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  if (loading) return (
    <div className="map-view-container">
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100%',
        background: '#0f172a',
        color: '#38bdf8'
      }}>
        <div className="loader">Loading map...</div>
      </div>
    </div>
  )

  if (error) return (
    <div className="map-view-container">
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100%',
        flexDirection: 'column',
        background: '#0f172a',
        color: '#ef4444',
        gap: '16px'
      }}>
        <h2>Error Loading Map</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} style={{
          padding: '12px 24px',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}>Reload</button>
      </div>
    </div>
  )

  return (
    <div className="map-view-container">
      <div className="map-sidebar">
        <div className="recommendations-section">
          <div className="section-header">
            <h2><i className="fas fa-robot"></i> AI Recommended</h2>
            {isPredicting && <span className="live-indicator"><i className="fas fa-spinner fa-spin"></i> Updating</span>}
          </div>
          <div className="recommendations-list">
            {sortedRecommendations.map(rec => {
              const prediction = predictions[rec.id]
              return (
                <div key={rec.id} className="rec-card" onClick={() => navigate('/slots/' + rec.id)}>
                  <div className="rec-badge">#{rec.rank} AI Recommended</div>
                  <h3>{rec.name}</h3>
                  <p><i className="fas fa-map-marker-alt"></i> {rec.sector || ''}</p>
                  <div className="rec-stats">
                    <span><i className="fas fa-car"></i> {rec.available} slots</span>
                    <span><i className="fas fa-route"></i> {rec.distance} km</span>
                  </div>
                  <div className="rec-confidence">
                    <div className="confidence-bar">
                      <div className="confidence-fill" style={{ width: `${rec.availabilityChance}%` }}></div>
                    </div>
                    <span className="confidence-text">{rec.availabilityChance}% Available</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <Suspense fallback={<MapFallback />}>
        <MapComponent 
          parkingData={parkingData}
          predictions={predictions}
          userLocation={userLocation}
          isTracking={isTracking}
        />
      </Suspense>

      <div className="map-legend">
        {userLocation && (
          <button className={`recenter-btn ${isTracking ? 'active' : ''}`} onClick={() => setIsTracking(!isTracking)}>
            <i className="fas fa-location-crosshairs"></i>
          </button>
        )}
        <div className="legend-item"><span className="dot available"></span> Available</div>
        <div className="legend-item"><span className="dot full"></span> Full</div>
      </div>

      {showLocationPopup && (
        <div className="location-permission-overlay">
          <div className="location-permission-card">
            <div className="location-icon"><i className="fas fa-map-marker-alt"></i></div>
            <h2>Enable Live Location</h2>
            <p>Allow location access to find nearest parking spots.</p>
            <div className="location-actions">
              <button className="btn-allow" onClick={enableLiveLocation}>Enable Location</button>
              <button className="btn-deny" onClick={() => setShowLocationPopup(false)}>Not Now</button>
            </div>
          </div>
        </div>
      )}

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: 'info' })} 
      />
    </div>
  )
}

export default MapView