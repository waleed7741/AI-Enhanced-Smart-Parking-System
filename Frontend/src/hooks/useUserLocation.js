// src/hooks/useUserLocation.js
import { useEffect, useRef, useState } from 'react'

// Dubai fallback (used if permission denied or GPS fails)
const FALLBACK_POSITION = {
  lat: 25.2048,
  lng: 55.2708,
}

export default function useUserLocation() {
  const [position, setPosition] = useState(null)
  const [permissionStatus, setPermissionStatus] = useState('idle') // idle | pending | granted | denied
  const [error, setError] = useState(null)
  const watchIdRef = useRef(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionStatus('denied')
      setError('Geolocation is not supported in this browser.')
      return
    }

    setPermissionStatus('pending')

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
        setPermissionStatus('granted')
        setError(null)
      },
      err => {
        console.error('Geolocation error', err)
        setPermissionStatus('denied')
        setError('Location access denied. Using Dubai as fallback.')
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    )

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // If no live position yet, use Dubai fallback
  const activePosition = position || FALLBACK_POSITION

  return {
    position,          // null until GPS lock
    activePosition,    // always non-null (live or fallback)
    permissionStatus,  // idle | pending | granted | denied
    error,
  }
}