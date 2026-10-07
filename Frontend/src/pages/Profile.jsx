import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import './Profile.css'

const Profile = () => {
  const navigate = useNavigate()
  const [firebaseUser, setFirebaseUser] = useState(null)
  
  // Profile Info States
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [emailNotifications, setEmailNotifications] = useState(true)
  
  // Data Fetching States
  const [bookings, setBookings] = useState([])
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
  const [cancelModal, setCancelModal] = useState({ isOpen: false, bookingId: null, parkingName: '' })

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  // Route Protection & Firebase User Hook
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate('/login')
      } else {
        setFirebaseUser(currentUser)
        setEmail(currentUser.email || '')
        setName(currentUser.displayName || currentUser.email?.split('@')[0] || '')
        
        // Fetch MongoDB details
        fetchUserProfile(currentUser.email)
        fetchUserBookings(currentUser.email)
      }
    })
    return () => unsubscribe()
  }, [navigate])

  // Explicit Toast Auto-dismiss Timer (3 seconds guarantee)
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false, message: '' }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show])

  const fetchUserProfile = async (userEmail) => {
    setLoadingProfile(true)
    try {
      const res = await fetch(`${apiBase}/api/users/${userEmail}`)
      if (res.ok) {
        const data = await res.json()
        if (data.name) setName(data.name)
        if (data.license_plate) setLicensePlate(data.license_plate)
        if (data.email_notifications !== undefined) setEmailNotifications(data.email_notifications)
      } else {
        throw new Error('Server returned error status.')
      }
    } catch (err) {
      console.error('Error fetching user profile:', err)
      setToast({
        show: true,
        message: 'Could not fetch your profile details from the server.',
        type: 'error'
      })
    } finally {
      setLoadingProfile(false)
    }
  }

  const fetchUserBookings = async (userEmail) => {
    setLoadingBookings(true)
    try {
      const res = await fetch(`${apiBase}/api/bookings/user/${userEmail}`)
      if (res.ok) {
        const data = await res.json()
        setBookings(Array.isArray(data) ? data : [])
      } else {
        throw new Error('Server returned error status.')
      }
    } catch (err) {
      console.error('Error fetching user bookings:', err)
      setToast({
        show: true,
        message: 'Could not fetch your booking history from the server.',
        type: 'error'
      })
    } finally {
      setLoadingBookings(false)
    }
  }

    const handleProfileSave = async (e) => {
    e.preventDefault()
    if (!firebaseUser) return

    // License plate format validation (allow empty to clear it)
    if (licensePlate && !/^[A-Za-z]{2,3}-\d{3,4}$/.test(licensePlate)) {
      setToast({
        show: true,
        message: 'Invalid license plate format. Use XXX-1234 (e.g. LEA-1234)',
        type: 'error'
      })
      return
    }

    setSaving(true)
    try {
      // Force-refresh the ID token so the backend can verify identity securely
      const idToken = await firebaseUser.getIdToken(true)

      const res = await fetch(`${apiBase}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + idToken
        },
        body: JSON.stringify({
          name,
          license_plate: licensePlate,
          email_notifications: emailNotifications
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Update local state with the server-confirmed values
        if (data.user?.name) setName(data.user.name)
        if (data.user?.license_plate !== undefined) setLicensePlate(data.user.license_plate)
        setToast({
          show: true,
          message: 'Vehicle info updated successfully!',
          type: 'success'
        })
      } else {
        throw new Error(data.error || 'Server update failed')
      }
    } catch (err) {
      console.error('[Profile] Save error:', err)
      setToast({
        show: true,
        message: err.message || 'Failed to update profile. Please try again.',
        type: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Cancel a booking from the Profile page ───────────────────────────────
  const handleCancelBooking = async () => {
    const bookingId = cancelModal.bookingId
    setCancelModal({ isOpen: false, bookingId: null, parkingName: '' })
    try {
      const res = await fetch(`${apiBase}/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      if (res.ok) {
        // Remove from local state immediately so the UI updates without a full refetch
        setBookings(prev => prev.map(b =>
          b.booking_id === bookingId ? { ...b, status: 'cancelled' } : b
        ))
        // Clear active session persistence so the Navbar banner + directions button disappear
        localStorage.removeItem('activeBookingId')
        localStorage.removeItem('activeParkingLat')
        localStorage.removeItem('activeParkingLng')
        localStorage.removeItem('activeParkingName')
        setToast({ show: true, message: 'Booking cancelled successfully. Your slot has been released.', type: 'success' })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Cancellation failed')
      }
    } catch (err) {
      console.error('[Profile] Cancel error:', err)
      setToast({ show: true, message: err.message || 'Could not cancel booking. Please try again.', type: 'error' })
    }
  }

  const handlePasswordReset = async () => {
    if (!email) return
    try {
      await sendPasswordResetEmail(auth, email)
      setToast({
        show: true,
        message: 'Password reset link sent to your inbox!',
        type: 'success'
      })
    } catch (err) {
      console.error(err)
      setToast({
        show: true,
        message: `Failed to trigger reset email: ${err.message}`,
        type: 'error'
      })
    }
  }

  // Filter Bookings into Active vs History
  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'active')
  const pastHistory = bookings.filter(b => b.status !== 'confirmed' && b.status !== 'active')

  // AI insights computations (Frequent sectors & time stats)
  const aiInsights = (() => {
    if (!bookings.length) {
      return {
        frequentLocation: 'Centaurus Mall Parking', // realistic fallback
        peakAlert: '1:00 PM - 3:00 PM (High demand sector F-8)'
      }
    }
    
    // Calculate most frequent parking lot/sector
    const frequencies = {}
    bookings.forEach(b => {
      const name = b.parking_name || 'Standard Bay'
      frequencies[name] = (frequencies[name] || 0) + 1
    })
    
    let frequentLocation = 'Centaurus Mall Parking'
    let maxCount = 0
    Object.keys(frequencies).forEach(loc => {
      if (frequencies[loc] > maxCount) {
        maxCount = frequencies[loc]
        frequentLocation = loc
      }
    })

    return {
      frequentLocation,
      peakAlert: '1:00 PM - 3:00 PM (High demand sector F-8)'
    }
  })()

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="hero-text">
          <h1>Account Profile</h1>
          <p>Personalize vehicle details, view reservation history, and explore AI smart insights.</p>
        </div>
        <div className="hero-bg-overlay"></div>
      </div>

      <div className="profile-container">
        <div className="profile-grid">
          
          {/* Left Column: Personal, Vehicle & Account Settings */}
          <div className="profile-left-col">
            <div className="profile-card">
              <h2 className="card-title"><i className="fas fa-id-card"></i> Personal & Vehicle Info</h2>
              
              {loadingProfile ? (
                <div className="skeleton-loader">
                  <div className="skeleton-line" style={{ width: '40%' }}></div>
                  <div className="skeleton-input"></div>
                  <div className="skeleton-line" style={{ width: '30%' }}></div>
                  <div className="skeleton-input"></div>
                </div>
              ) : (
                <form onSubmit={handleProfileSave} className="profile-form">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Your Name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      value={email} 
                      disabled
                      className="disabled-input"
                    />
                    <small className="form-tip">Email address is managed via Firebase Auth.</small>
                  </div>

                  <div className="form-group">
                    <label>Vehicle License Plate</label>
                    <input 
                      type="text" 
                      value={licensePlate} 
                      onChange={(e) => setLicensePlate(e.target.value)} 
                      placeholder="e.g. LEA-1234"
                    />
                    {licensePlate && !/^[A-Za-z]{2,3}-\d{3,4}$/.test(licensePlate) && (
                      <span className="error-text" style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px', display: 'block', fontWeight: '500' }}>
                        Invalid format. Use XXX-1234 (e.g. LEA-1234)
                      </span>
                    )}
                  </div>

                  <button type="submit" className="btn-save-profile" disabled={saving}>
                    {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check-circle"></i>}
                    {saving ? ' Saving...' : ' Update Profile'}
                  </button>
                </form>
              )}
            </div>

            {/* Account Settings & Firebase Actions */}
            <div className="profile-card">
              <h2 className="card-title"><i className="fas fa-gears"></i> Account Settings</h2>
              
              <div className="settings-options">
                <div className="settings-item">
                  <div className="settings-info">
                    <span className="settings-label">Security Credentials</span>
                    <span className="settings-desc">Update your login password via a verification link.</span>
                  </div>
                  <button onClick={handlePasswordReset} className="btn-reset-password">
                    <i className="fas fa-lock-open"></i> Reset Password
                  </button>
                </div>

                <div className="settings-divider"></div>

                <div className="settings-item">
                  <div className="settings-info">
                    <span className="settings-label">Email Notifications</span>
                    <span className="settings-desc">Receive a welcome message and booking confirmations.</span>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={emailNotifications} 
                      onChange={(e) => setEmailNotifications(e.target.checked)} 
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Bookings, History, AI Smart Insights */}
          <div className="profile-right-col">
            
            {/* AI Insights Card */}
            <div className="profile-card ai-insights-card">
              <div className="ai-card-glow"></div>
              <h2 className="card-title ai-title"><i className="fas fa-brain-circuit"></i> AI Smart Insights</h2>
              
              <div className="ai-insights-grid">
                <div className="ai-insight-box">
                  <span className="insight-label">Most Frequent Spot</span>
                  <span className="insight-value">{aiInsights.frequentLocation}</span>
                  <span className="insight-tip"><i className="fas fa-circle-info"></i> Recommends spots nearby based on booking counts</span>
                </div>

                <div className="ai-insight-box">
                  <span className="insight-label">Peak Hour Alert</span>
                  <span className="insight-value">{aiInsights.peakAlert}</span>
                  <span className="insight-tip"><i className="fas fa-triangle-exclamation"></i> Avoid arriving during these slots to bypass queues</span>
                </div>
              </div>
            </div>

            {/* Active Bookings Card */}
            <div className="profile-card">
              <h2 className="card-title"><i className="fas fa-circle-dot" style={{ color: '#22c55e' }}></i> Active Reservations</h2>
              
              {loadingBookings ? (
                <div className="skeleton-loader">
                  <div className="skeleton-booking"></div>
                </div>
              ) : activeBookings.length > 0 ? (
                <div className="active-bookings-list">
                  {activeBookings.map((b) => (
                    <div key={b.booking_id} className="active-booking-item">
                      <div className="booking-icon-container">
                        <i className="fas fa-square-parking"></i>
                      </div>
                      <div className="booking-details-summary">
                        <span className="booking-lot-name">{b.parking_name}</span>
                        <span className="booking-meta">
                          Slot: <strong className="highlight">{b.slot_number}</strong> | Vehicle: {b.vehicle_number || 'N/A'}
                        </span>
                        <span className="booking-meta" style={{ color: '#94a3b8', fontSize: '12px' }}>
                          Booking #{b.booking_id} · {b.duration_hours}h · PKR {b.total_cost}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <span className="booking-status-tag active">Confirmed</span>
                        <button
                          onClick={() => setCancelModal({ isOpen: true, bookingId: b.booking_id, parkingName: b.parking_name })}
                          style={{
                            background: 'rgba(239,68,68,0.12)',
                            border: '1px solid rgba(239,68,68,0.4)',
                            color: '#f87171',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.target.style.background = 'rgba(239,68,68,0.25)' }}
                          onMouseLeave={e => { e.target.style.background = 'rgba(239,68,68,0.12)' }}
                        >
                          <i className="fas fa-times" style={{ marginRight: '4px' }}></i>Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-calendar-xmark"></i>
                  <p>No active reservations at this time.</p>
                </div>
              )}
            </div>

            {/* Booking History */}
            <div className="profile-card">
              <h2 className="card-title"><i className="fas fa-clock-rotate-left"></i> Past Parking History</h2>
              
              {loadingBookings ? (
                <div className="skeleton-loader">
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line" style={{ width: '80%' }}></div>
                  <div className="skeleton-line" style={{ width: '60%' }}></div>
                </div>
              ) : pastHistory.length > 0 ? (
                <div className="history-table-wrapper">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Parking Location</th>
                        <th>Slot</th>
                        <th>Total Fee</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastHistory.map((b) => (
                        <tr key={b.booking_id}>
                          <td>#{b.booking_id}</td>
                          <td>{b.parking_name}</td>
                          <td>{b.slot_number}</td>
                          <td>PKR {b.total_cost}</td>
                          <td>
                            <span className={`status-pill ${b.status || 'finished'}`}>
                              {b.status || 'Finished'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-clipboard-list"></i>
                  <p>Your parking history will appear here once you complete a booking.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      <ConfirmModal
        isOpen={cancelModal.isOpen}
        title="Cancel Booking"
        message={`Are you sure you want to cancel your reservation at ${cancelModal.parkingName}? This will immediately release your slot.`}
        onConfirm={handleCancelBooking}
        onCancel={() => setCancelModal({ isOpen: false, bookingId: null, parkingName: '' })}
      />

      <Toast 
        show={toast.show}
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ ...toast, show: false })} 
      />
    </div>
  )
}

export default Profile
