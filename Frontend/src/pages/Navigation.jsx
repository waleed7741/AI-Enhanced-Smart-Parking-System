import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useNavigate } from 'react-router-dom'
import './Navigation.css'

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Component to handle map interactions like auto-centering
const MapController = ({ userLoc, destLoc, shouldFollow, route }) => {
  const map = useMap()
  const firstLoad = useRef(true)

  useEffect(() => {
    if (firstLoad.current && userLoc) {
      map.setView(userLoc, 16)
      firstLoad.current = false
    } else if (shouldFollow && userLoc) {
      map.panTo(userLoc)
    }
  }, [userLoc, shouldFollow, map])

  useEffect(() => {
    if (route && route.length > 0 && firstLoad.current) {
      const bounds = L.latLngBounds([userLoc, destLoc, ...route])
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [route, userLoc, destLoc, map])

  return null
}

const Navigation = () => {
  const navigate = useNavigate()
  const selectedParking = JSON.parse(localStorage.getItem('selectedParking') || '{}')
  
  const destLoc = [selectedParking.latitude || 33.6844, selectedParking.longitude || 73.0479]
  const [userLoc, setUserLoc] = useState([33.7077, 73.0645]) // Initial fallback
  const [route, setRoute] = useState([])
  const [instructions, setInstructions] = useState([])
  const [shouldFollow, setShouldFollow] = useState(true)
  const [distance, setDistance] = useState(0)
  const [duration, setDuration] = useState(0)

  // Live Tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by your browser")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLoc([latitude, longitude])
      },
      (error) => console.error("Error watching position:", error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Fetch Route from OSRM
  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${userLoc[1]},${userLoc[0]};${destLoc[1]},${destLoc[0]}?overview=full&geometries=geojson&steps=true`
        )
        const data = await response.json()
        
        if (data.routes && data.routes[0]) {
          const coordinates = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]])
          setRoute(coordinates)
          setInstructions(data.routes[0].legs[0].steps)
          setDistance(data.routes[0].distance)
          setDuration(data.routes[0].duration)
        }
      } catch (error) {
        console.error("Error fetching route:", error)
      }
    }

    if (userLoc && destLoc) {
      fetchRoute()
    }
  }, [userLoc[0], userLoc[1]]) // Re-fetch only when user location changes significantly or on load

  const userIcon = L.divIcon({
    className: 'user-marker-container',
    html: `
      <div class="user-marker-pulse"></div>
      <div class="user-marker-inner">
        <i class="fas fa-location-arrow"></i>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  })

  const destIcon = L.divIcon({
    className: 'dest-marker',
    html: '<i class="fas fa-parking" style="color: #ef4444; font-size: 28px;"></i>',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  })

  const formatDistance = (meters) => {
    if (meters > 1000) return (meters / 1000).toFixed(1) + ' km'
    return Math.round(meters) + ' m'
  }

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60)
      return `${hours} hr ${minutes % 60} min`
    }
    return `${minutes} min`
  }

  const handleFinishNavigation = async () => {
    const currentBooking = JSON.parse(localStorage.getItem('currentBooking') || '{}')
    const bookingId = currentBooking.bookingId || currentBooking.booking_id

    if (bookingId) {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const response = await fetch(`${apiBase}/api/bookings/${bookingId}/finish`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const data = await response.json()
        if (response.ok && data.success) {
          console.log('Booking finished and slot released successfully:', data)
        } else {
          console.error('Failed to finish booking on backend:', data.error)
        }
      } catch (error) {
        console.error('Error completing parking session:', error)
      }
    }

    localStorage.removeItem('bookingInfo')
    localStorage.removeItem('selectedParking')
    localStorage.removeItem('selectedSlot')
    localStorage.removeItem('currentBooking')
    navigate('/map')
  }

  return (
    <div className="navigation-page">
      <div className="nav-sidebar">
        <div className="nav-header">
          <div className="header-top">
            <h2><i className="fas fa-directions"></i> Navigation</h2>
            <button className="btn-close" onClick={handleFinishNavigation}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <p className="dest-info">Heading to <strong>{selectedParking.name || 'Parking Slot'}</strong></p>
          <div className="route-summary">
            <div className="summary-item">
              <span className="label">Distance</span>
              <span className="value">{formatDistance(distance)}</span>
            </div>
            <div className="summary-item">
              <span className="label">ETA</span>
              <span className="value">{formatDuration(duration)}</span>
            </div>
          </div>
        </div>

        <div className="instruction-list">
          {instructions.length > 0 ? (
            instructions.map((step, index) => (
              <div key={index} className={`instruction-item ${index === 0 ? 'active' : ''}`}>
                <div className="instruction-icon">
                  <i className={`fas ${getStepIcon(step.maneuver.type, step.maneuver.modifier)}`}></i>
                </div>
                <div className="instruction-content">
                  <span className="instruction-text">{step.maneuver.instruction || step.name || "Continue"}</span>
                  <span className="instruction-subtext">{formatDistance(step.distance)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="loading-instructions">
              <div className="spinner"></div>
              <span>Calculating best route...</span>
            </div>
          )}
          
          <div className="instruction-item arrive">
            <div className="instruction-icon">
              <i className="fas fa-flag-checkered"></i>
            </div>
            <div className="instruction-content">
              <span className="instruction-text">Arrive at {selectedParking.name || 'Destination'}</span>
            </div>
          </div>
        </div>

        <button className="btn-finish" onClick={handleFinishNavigation} id="btn-finish-navigation">
          Finish Navigation
        </button>
      </div>

      <div className="nav-map-container">
        <MapContainer 
          center={userLoc} 
          zoom={16} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapController 
              userLoc={userLoc} 
              destLoc={destLoc} 
              shouldFollow={shouldFollow} 
              route={route}
            />

            {route.length > 0 && (
              <Polyline 
                positions={route} 
                pathOptions={{ 
                  color: '#1D9BF0', 
                  weight: 8, 
                  opacity: 0.8,
                  lineJoin: 'round'
                }} 
              />
            )}

          <Marker position={userLoc} icon={userIcon}>
            <Popup>Your Location</Popup>
          </Marker>

          <Marker position={destLoc} icon={destIcon}>
            <Popup>{selectedParking.name}</Popup>
          </Marker>

          <div className="map-controls">
            <button 
              className={`control-btn ${shouldFollow ? 'active' : ''}`}
              onClick={() => setShouldFollow(!shouldFollow)}
              title="Toggle Follow Me"
            >
              <i className="fas fa-crosshairs"></i>
            </button>
          </div>
        </MapContainer>
      </div>
    </div>
  )
}

// Helper to map OSRM maneuver types to FontAwesome icons
const getStepIcon = (type, modifier) => {
  if (type === 'arrive') return 'fa-flag-checkered'
  if (type === 'depart') return 'fa-location-arrow'
  
  switch (modifier) {
    case 'right': return 'fa-arrow-right'
    case 'left': return 'fa-arrow-left'
    case 'slight right': return 'fa-location-arrow fa-rotate-45'
    case 'slight left': return 'fa-location-arrow fa-rotate-315'
    case 'sharp right': return 'fa-arrow-right'
    case 'sharp left': return 'fa-arrow-left'
    case 'straight': return 'fa-arrow-up'
    case 'uturn': return 'fa-undo'
    default: return 'fa-arrow-up'
  }
}

export default Navigation
