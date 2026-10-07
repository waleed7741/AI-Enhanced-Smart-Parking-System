import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'

const ActiveSession = () => {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds since booking_time
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' })

  // ── Fetch the booking from backend ────────────────────────────────────────
  useEffect(() => {
    if (!bookingId) { navigate('/map'); return }

    const fetchBooking = async () => {
      try {
        // Try to get from localStorage first for instant render
        const cached = JSON.parse(localStorage.getItem('currentBooking') || '{}')
        if (cached && String(cached.bookingId) === String(bookingId)) {
          setBooking(cached)
        }

        // Always validate against backend
        const res = await fetch(`${apiBase}/api/bookings`)
        if (res.ok) {
          const all = await res.json()
          const found = all.find(b => String(b.booking_id) === String(bookingId))
          if (found) {
            setBooking(found)
          } else if (!cached.bookingId) {
            // Booking not found anywhere — may have already been finished
            navigate('/map')
          }
        }
      } catch (err) {
        console.warn('[ActiveSession] Backend unreachable, using cached data:', err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchBooking()
  }, [bookingId, apiBase, navigate])

  // ── Live elapsed timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!booking) return
    const startTime = new Date(booking.booking_time || booking.bookingTime || Date.now())
    const tick = () => setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [booking])

  const formatElapsed = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  // ── Finish the session ────────────────────────────────────────────────────
  const handleFinish = async () => {
    setFinishing(true)
    try {
      const res = await fetch(`${apiBase}/api/bookings/${bookingId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()

      if (res.ok && data.success) {
        // Clear all active session persistence
        localStorage.removeItem('activeBookingId')
        localStorage.removeItem('activeParkingLat')
        localStorage.removeItem('activeParkingLng')
        localStorage.removeItem('activeParkingName')
        localStorage.removeItem('currentBooking')
        localStorage.removeItem('bookingInfo')
        localStorage.removeItem('selectedParking')
        localStorage.removeItem('selectedSlot')

        setToast({ show: true, message: '🎉 Session finished! Your slot has been released.', type: 'success' })
        setTimeout(() => navigate('/map'), 1800)
      } else {
        throw new Error(data.error || 'Finish request failed')
      }
    } catch (err) {
      console.error('[ActiveSession] Finish error:', err)
      setToast({ show: true, message: err.message || 'Could not finish session. Please try again.', type: 'error' })
    } finally {
      setFinishing(false)
    }
  }

  // ── Build Google Maps directions URL from parking location data ─────────────
  const buildGoogleMapsUrl = (resolvedParkingName) => {
    // Prefer precise coordinates (stored in parking doc / cached booking)
    const lat = booking?.latitude ?? booking?.parking_lat ?? null
    const lng = booking?.longitude ?? booking?.parking_lng ?? null

    if (lat && lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    }

    // Fallback: use the parking name + "Islamabad" as a text search destination
    if (resolvedParkingName && resolvedParkingName !== '—') {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${resolvedParkingName}, Islamabad, Pakistan`)}`
    }

    return null
  }

  // ── Get booking field with fallback for both shape conventions ────────────
  const get = (field, alt, fallback = '—') =>
    booking?.[field] ?? booking?.[alt] ?? fallback

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingBox}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '28px', color: '#38bdf8' }}></i>
          <p style={{ color: '#94a3b8', marginTop: '12px' }}>Loading your active session…</p>
        </div>
      </div>
    )
  }

  if (!booking) return null

  const durationHours = get('duration_hours', 'duration', 1)
  const totalCost = get('total_cost', 'totalCost', 0)
  const slotNumber = get('slot_number', 'slotNumber', 'Auto')
  const parkingName = get('parking_name', 'parkingName', 'Parking')
  const vehicleNumber = get('vehicle_number', 'vehicleNumber', '—')
  const maxSecs = durationHours * 3600
  const progressPct = Math.min((elapsed / maxSecs) * 100, 100)
  const timeLeft = Math.max(maxSecs - elapsed, 0)
  const mapsUrl = buildGoogleMapsUrl(parkingName)

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div>
          <h1 style={styles.title}><i className="fas fa-circle-dot" style={{ color: '#22c55e', marginRight: '10px', animation: 'pulse 2s infinite' }}></i>Active Parking Session</h1>
          <p style={styles.subtitle}>Booking #{bookingId}</p>
        </div>
      </div>

      <div style={styles.grid}>
        {/* ── Session Timer Card ── */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}><i className="fas fa-clock"></i> Session Timer</h3>
          <div style={styles.timerDisplay}>{formatElapsed(elapsed)}</div>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            {timeLeft > 0
              ? `${formatElapsed(timeLeft)} remaining of ${durationHours}h booked`
              : '⚠️ Session duration exceeded — please finish now'}
          </p>
          {/* Progress bar */}
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progressPct}%`, background: progressPct > 90 ? '#ef4444' : progressPct > 70 ? '#f59e0b' : '#22c55e' }}></div>
          </div>
        </div>

        {/* ── Booking Details Card ── */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}><i className="fas fa-ticket"></i> Booking Details</h3>
          <div style={styles.detailGrid}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>📍 Location</span>
              <span style={styles.detailValue}>{parkingName}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>🅿️ Slot</span>
              <span style={styles.detailValue}>{slotNumber}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>🚗 Vehicle</span>
              <span style={styles.detailValue}>{vehicleNumber}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>⏱️ Duration</span>
              <span style={styles.detailValue}>{durationHours}h</span>
            </div>
            <div style={{ ...styles.detailRow, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', marginTop: '4px' }}>
              <span style={styles.detailLabel}>💰 Total</span>
              <span style={{ ...styles.detailValue, color: '#38bdf8', fontWeight: '700', fontSize: '16px' }}>PKR {totalCost}</span>
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={styles.cardTitle}><i className="fas fa-bolt"></i> Quick Actions</h3>

          {/* Get Directions — only rendered when a Maps URL can be constructed */}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.googleMapsBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.22)'; e.currentTarget.style.borderColor = 'rgba(99,179,251,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.12)'; e.currentTarget.style.borderColor = 'rgba(99,179,251,0.35)' }}
            >
              <i className="fas fa-map-location-dot" style={{ marginRight: '8px', fontSize: '15px' }}></i>
              Get Directions via Google Maps
              <i className="fas fa-arrow-up-right-from-square" style={{ marginLeft: '8px', fontSize: '11px', opacity: 0.7 }}></i>
            </a>
          ) : (
            <div style={{ padding: '11px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', color: '#475569', fontSize: '13px', textAlign: 'center' }}>
              <i className="fas fa-map-pin" style={{ marginRight: '6px' }}></i>
              Location data not available for directions
            </div>
          )}

          <button
            onClick={handleFinish}
            disabled={finishing}
            style={{ ...styles.finishBtn, opacity: finishing ? 0.7 : 1 }}
            onMouseEnter={e => !finishing && (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {finishing
              ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Finishing…</>
              : <><i className="fas fa-flag-checkered" style={{ marginRight: '8px' }}></i>Finish &amp; Release Slot</>
            }
          </button>

          <p style={{ fontSize: '11px', color: '#475569', textAlign: 'center', marginTop: '4px' }}>
            Finishing will release your slot immediately and mark the booking as completed.
          </p>
        </div>
      </div>

      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
    </div>
  )
}

// ── Inline styles (no external CSS needed) ────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    padding: '100px 24px 40px',
    fontFamily: "'Inter', sans-serif"
  },
  loadingBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh'
  },
  header: {
    maxWidth: '900px', margin: '0 auto 32px', display: 'flex', alignItems: 'center', gap: '16px'
  },
  backBtn: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#94a3b8', width: '40px', height: '40px', borderRadius: '10px',
    cursor: 'pointer', fontSize: '16px', flexShrink: 0
  },
  title: {
    margin: 0, fontSize: '22px', color: '#f1f5f9', fontWeight: '700'
  },
  subtitle: {
    margin: '4px 0 0', fontSize: '13px', color: '#64748b'
  },
  grid: {
    maxWidth: '900px', margin: '0 auto', display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px'
  },
  card: {
    background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px', padding: '22px', backdropFilter: 'blur(12px)'
  },
  cardTitle: {
    margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px'
  },
  timerDisplay: {
    fontSize: '42px', fontWeight: '800', color: '#38bdf8',
    letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums'
  },
  progressTrack: {
    height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px',
    marginTop: '12px', overflow: 'hidden'
  },
  progressFill: {
    height: '100%', borderRadius: '99px', transition: 'width 1s linear, background 0.5s'
  },
  detailGrid: { display: 'flex', flexDirection: 'column', gap: '10px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: '13px', color: '#64748b' },
  detailValue: { fontSize: '14px', color: '#e2e8f0', fontWeight: '500', textAlign: 'right' },
  dirBtn: {
    width: '100%', padding: '12px', border: '1px solid rgba(56,189,248,0.3)',
    background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '10px',
    cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'background 0.2s'
  },
  googleMapsBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '12px', boxSizing: 'border-box',
    border: '1px solid rgba(99,179,251,0.35)',
    background: 'rgba(59,130,246,0.12)', color: '#93c5fd', borderRadius: '10px',
    cursor: 'pointer', fontSize: '14px', fontWeight: '600',
    textDecoration: 'none', transition: 'background 0.2s, border-color 0.2s'
  },
  finishBtn: {
    width: '100%', padding: '14px', border: 'none',
    background: 'linear-gradient(135deg, #16a34a, #15803d)',
    color: '#fff', borderRadius: '10px', cursor: 'pointer', fontSize: '15px',
    fontWeight: '700', transition: 'transform 0.15s, opacity 0.2s',
    boxShadow: '0 4px 20px rgba(22,163,74,0.35)'
  }
}

export default ActiveSession
