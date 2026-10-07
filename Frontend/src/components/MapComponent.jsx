import { useEffect, useRef, memo } from 'react'

const MapComponent = ({ parkingData, predictions, userLocation, isTracking }) => {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)
  const hasCenteredRef = useRef(false)
  
  // Islamabad Center coordinates
  const lng = 73.0479
  const lat = 33.6844
  const zoom = 13

  // Initialize Leaflet Map
  useEffect(() => {
    const initMap = () => {
      if (map.current || !mapContainer.current || !window.L) return

      try {
        const m = window.L.map(mapContainer.current, {
          center: [lat, lng],
          zoom: zoom,
          zoomControl: true,
          scrollWheelZoom: true
        })

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(m)

        map.current = m
        console.log('Map initialized successfully in MapComponent')
        
        // Initial invalidation trigger shortly after creation
        setTimeout(() => {
          if (map.current) {
            map.current.invalidateSize()
          }
        }, 100)
      } catch (err) {
        console.error('Map initialization error:', err)
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initMap, 200)

    return () => {
      clearTimeout(timer)
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Fix Leaflet "grey tile" bug by invalidating size after mount and sidebar layout stabilizes
  useEffect(() => {
    const timers = [
      setTimeout(() => {
        if (map.current) {
          console.log('Invalidating map size after 300ms to fix grey tiles...')
          map.current.invalidateSize()
        }
      }, 300),
      setTimeout(() => {
        if (map.current) {
          console.log('Invalidating map size after 800ms to fix grey tiles...')
          map.current.invalidateSize()
        }
      }, 800),
      setTimeout(() => {
        if (map.current) {
          console.log('Invalidating map size after 1500ms to fix grey tiles...')
          map.current.invalidateSize()
        }
      }, 1500)
    ]

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

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

  // Add/update markers when map or parking data updates
  useEffect(() => {
    if (!map.current || !window.L || parkingData.length === 0) return

    // Clear existing markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    parkingData.forEach(parking => {
      if (!parking.latitude || !parking.longitude) return

      const color = parking.status === 'full' ? '#ef4444' : '#10b981'

      const icon = window.L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })

      const prediction = predictions[parking.id]
      const chance = prediction ? calculateAvailabilityChance(parking, prediction) : 50

      const popupContent = `
        <div style="min-width: 200px; font-family: 'Inter', sans-serif;">
          <h3 style="margin: 0 0 8px 0; color: #1e293b;">${parking.name}</h3>
          <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">${parking.sector || ''}</p>
          <p style="margin: 0 0 8px 0; font-size: 14px;">
            <strong>Slots:</strong> ${parking.available}/${parking.capacity}
          </p>
          <div style="background: linear-gradient(90deg, #22c55e ${chance}%, #e5e7eb ${chance}%); padding: 8px; border-radius: 6px; margin-bottom: 12px;">
            <small><strong>${chance}% Available</strong></small>
          </div>
          <button onclick="window.location.href='/slots/${parking.id}'"
            style="background: #38bdf8; color: #0f172a; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 600;">
            Book Now
          </button>
        </div>
      `

      const marker = window.L.marker([parking.latitude, parking.longitude], { icon })
        .bindPopup(popupContent)
        .addTo(map.current)

      markersRef.current.push(marker)
    })
  }, [parkingData, predictions])

  // Update user location marker
  useEffect(() => {
    if (!map.current || !window.L || !userLocation) return

    const { lat, lng } = userLocation

    if (!userMarkerRef.current) {
      const userIcon = window.L.divIcon({
        className: 'user-location-icon',
        html: `<div style="width: 16px; height: 16px; background: #3b82f6; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
      userMarkerRef.current = window.L.marker([lat, lng], { icon: userIcon }).addTo(map.current)
    } else {
      userMarkerRef.current.setLatLng([lat, lng])
    }

    if (!hasCenteredRef.current || isTracking) {
      map.current.setView([lat, lng], 15)
      hasCenteredRef.current = true
    }
  }, [userLocation, isTracking])

  return <div ref={mapContainer} className="map-container" style={{ flex: 1, height: '100%', position: 'relative' }} />
}

// Wrap in React.memo and define a custom comparison function to prevent heavy re-renders.
// We only trigger a re-render if the tracking mode, user location coordinates, length of parking data,
// or actual availability counts/status changes.
const MemoizedMapComponent = memo(MapComponent, (prevProps, nextProps) => {
  // If tracking or user location changed, re-render
  if (prevProps.isTracking !== nextProps.isTracking) return false
  if (prevProps.userLocation?.lat !== nextProps.userLocation?.lat || prevProps.userLocation?.lng !== nextProps.userLocation?.lng) return false

  // If parking data length changed, re-render
  if (prevProps.parkingData.length !== nextProps.parkingData.length) return false

  // If any parking available slots or status changed, re-render
  for (let i = 0; i < prevProps.parkingData.length; i++) {
    const prev = prevProps.parkingData[i]
    const next = nextProps.parkingData[i]
    if (prev.id !== next.id || prev.available !== next.available || prev.status !== next.status) {
      return false
    }
  }

  // If prediction objects differ or values changed, re-render
  if (Object.keys(prevProps.predictions).length !== Object.keys(nextProps.predictions).length) return false
  for (const key of Object.keys(prevProps.predictions)) {
    if (prevProps.predictions[key]?.confidence !== nextProps.predictions[key]?.confidence) {
      return false
    }
  }

  return true // Otherwise skip re-rendering MapComponent completely
})

export default MemoizedMapComponent
