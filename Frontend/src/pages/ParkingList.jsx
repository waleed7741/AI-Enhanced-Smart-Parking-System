import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './ParkingList.css'

const ParkingList = () => {
  const [parkingData, setParkingData] = useState([])
  const [predictions, setPredictions] = useState({})
  const [isPredicting, setIsPredicting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const liveIntervalRef = useRef(null)

  // Calculate availability chance based on actual slot data + ML prediction
  const calculateAvailabilityChance = (parking, mlPrediction) => {
    const slotRatio = parking.available / parking.capacity
    const actualPercentage = Math.round(slotRatio * 100)
    
    // If slots are full, chance is 0%
    if (parking.available === 0) {
      return 0
    }
    
    // If slots are empty (or nearly empty), chance should be high
    if (parking.available >= parking.capacity * 0.8) {
      return Math.min(95, actualPercentage)
    }
    
    // Prioritize actual slot percentage (70%) with ML enhancement (30%)
    const mlConfidence = mlPrediction ? mlPrediction.confidence : 50
    const combinedChance = Math.round(actualPercentage * 0.7 + mlConfidence * 0.3)
    
    return Math.min(95, Math.max(5, combinedChance)) // Ensure between 5-95%
  }

  // Dynamic sorted parking data based on prediction percentages
  const sortedParkingData = parkingData
    .map(parking => {
      const prediction = predictions[parking.id]
      const availabilityChance = prediction ? calculateAvailabilityChance(parking, prediction) : 50
      
      // Dynamic slot scaling: more percentage = more slots (max 350)
      const baseCapacity = parking.capacity
      const scaledAvailable = Math.round((availabilityChance / 100) * Math.min(baseCapacity, 350))
      
      return {
        ...parking,
        availabilityChance,
        rank: 0, // Will be set after sorting
        available: scaledAvailable // Use dynamic slot count
      }
    })
    .sort((a, b) => b.availabilityChance - a.availabilityChance) // Sort by descending percentage
    .map((parking, index) => ({
      ...parking,
      rank: index + 1 // Assign rank number (1-based)
    }))

  // Build prediction payload based on current time
  const buildPredictionPayload = (parking) => {
    const now = new Date()
    const hour = now.getHours()
    const day_of_week = (now.getDay() + 6) % 7 // Monday=0, Sunday=6
    const is_weekend = (day_of_week >= 5) ? 1 : 0
    
    // Use realistic values based on parking characteristics
    const trafficLevels = ['Low', 'Medium', 'High']
    const traffic = trafficLevels[parking.id % trafficLevels.length]
    const weather_temp = 20 + Math.random() * 15 // 20-35°C
    const weather_precip = Math.random() > 0.8 ? Math.random() * 5 : 0
    const proximity = Math.max(1, Math.round(Math.random() * 20))
    const spotSizes = ['Standard', 'Compact', 'Oversized']
    const spot_size = spotSizes[parking.id % spotSizes.length]

    return {
      hour,
      day_of_week,
      is_weekend,
      Nearby_Traffic_Level: traffic,
      Weather_Temperature: weather_temp,
      Weather_Precipitation: weather_precip,
      Proximity_To_Exit: proximity,
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
      console.error('Prediction error:', error)
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

  // Start live predictions (always on)
  useEffect(() => {
    if (parkingData.length === 0) return
    
    // Initial prediction
    predictAllParking()
    
    // Set up interval for live updates (every 45 seconds)
    liveIntervalRef.current = setInterval(() => {
      predictAllParking()
      // Simulate real-time slot fluctuation
      simulateSlotFluctuation()
    }, 45000)
    
    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current)
      }
    }
  }, [parkingData])

  // Simulate real-time slot fluctuation
  const simulateSlotFluctuation = () => {
    setParkingData(prevData => 
      prevData.map(parking => {
        // Random change between -5 and +5 slots
        const change = Math.floor(Math.random() * 11) - 5
        const newAvailable = Math.max(0, Math.min(parking.capacity, parking.available + change))
        
        return {
          ...parking,
          available: newAvailable
        }
      })
    )
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    
    fetch(`${apiBase}/api/parking`)
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`)
        return res.json()
      })
      .then(data => {
        const parkingList = Array.isArray(data) ? data : data.parking || []
        setParkingData(parkingList)
        predictAllParking()
      })
      .catch(err => {
        console.error('Error fetching live parking data:', err)
        setError('Failed to load parking locations. Please check if the server is running.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      background: '#0f172a',
      color: '#38bdf8'
    }}>
      <div className="loader">Loading parking locations...</div>
    </div>
  )

  if (error) return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'column',
      background: '#fef2f2',
      color: '#dc2626',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h2>Connection Error</h2>
      <p>{error}</p>
      <button 
        onClick={() => window.location.reload()}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Try Again
      </button>
    </div>
  )

  return (
    <div className="parking-list-container">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Select Parking Location</h1>
            <p>Available parking spots in Islamabad</p>
          </div>
        </div>
        {isPredicting && (
          <div className="predicting-indicator">
            <i className="fas fa-spinner fa-spin"></i> Updating predictions...
          </div>
        )}
      </div>
      
      <div className="parking-grid">
        {sortedParkingData.map(parking => {
          const prediction = predictions[parking.id]
          return (
            <div key={parking.id} className="parking-card">
              <div className="card-header">
                <h3>{parking.name}</h3>
                <span className={`status-tag ${parking.status}`}>{parking.status}</span>
              </div>
              <div className="card-body">
                <p><i className="fas fa-location-dot"></i> Sector: {parking.sector}</p>
                <p><i className="fas fa-car-side"></i> Total Slots: {parking.capacity}</p>
                <p><i className="fas fa-check-circle"></i> Available: {parking.available}</p>
                <p className="price"><i className="fas fa-tag"></i> PKR {parking.price}/hour</p>
                <div className="prediction-confidence">
                  <div className="confidence-bar">
                    <div 
                      className="confidence-fill" 
                      style={{ width: `${parking.availabilityChance}%` }}
                    ></div>
                  </div>
                  <span className="confidence-text">
                    Availability: {parking.availabilityChance}%
                  </span>
                </div>
              </div>
              <div className="card-footer">
                <button 
                  className="btn-proceed"
                  onClick={() => navigate(`/slots/${parking.id}`)}
                  disabled={parking.status === 'full'}
                >
                  Book Now
                  <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ParkingList
