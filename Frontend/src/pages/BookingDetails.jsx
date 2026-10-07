import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './BookingDetails.css'
import Toast from '../components/Toast'

const BookingDetails = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get selected parking from localStorage or location state
  const selectedParking = location.state?.parking || JSON.parse(localStorage.getItem('selectedParking') || '{}')
  const selectedSlot = location.state?.slot || JSON.parse(localStorage.getItem('selectedSlot') || '{}')
  const paymentStatus = location.state?.paymentStatus
  
  const [formData, setFormData] = useState({
    userName: localStorage.getItem('userName') || '',
    vehicleNumber: '',
    duration: 1,
    agreeTerms: false
  })

  // plateIsLocked = true when the user already has a saved plate in their profile
  const [plateIsLocked, setPlateIsLocked] = useState(false)
  // profileLoading = true while fetching, disables input during fetch
  const [profileLoading, setProfileLoading] = useState(true)
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'info' })
  
  const totalPrice = (selectedParking.price || 0) * formData.duration

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  // ── Fetch user profile on mount to auto-fill and conditionally lock the plate ──
  useEffect(() => {
    const userEmail = localStorage.getItem('userEmail')
    if (!userEmail) {
      setProfileLoading(false)
      return
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${apiBase}/api/users/${encodeURIComponent(userEmail)}`)
        if (res.ok) {
          const data = await res.json()
          const savedPlate = data.license_plate || ''
          if (savedPlate) {
            // User already has a plate saved — pre-fill and lock the input
            setFormData(prev => ({ ...prev, vehicleNumber: savedPlate }))
            setPlateIsLocked(true)
          }
          // If no saved plate, leave blank and editable for first-time entry
        }
      } catch (err) {
        console.warn('[BookingDetails] Could not fetch user profile:', err)
      } finally {
        setProfileLoading(false)
      }
    }

    fetchProfile()
  }, [apiBase])
  
  useEffect(() => {
    // If no parking data, redirect to map
    if (!hasParkingData) {
      navigate('/map')
    }
  }, [selectedParking, navigate])
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }
  
  const handleContinueToPayment = () => {
    if (!formData.userName.trim() || !formData.vehicleNumber.trim()) {
      setToast({ message: 'Please fill in all required fields (Name and Vehicle License Plate)', type: 'warning' })
      return
    }

    if (!formData.agreeTerms) {
      setToast({ message: 'Please agree to the terms and conditions', type: 'warning' })
      return
    }

    // Store form data and navigate to payment
    const bookingInfo = {
      userName: formData.userName.trim(),
      vehicleNumber: formData.vehicleNumber.trim(),
      duration: formData.duration,
      totalPrice,
      selectedParking,
      selectedSlot
    }
    localStorage.setItem('bookingInfo', JSON.stringify(bookingInfo))
    navigate('/payment', { state: bookingInfo })
  }

  // Check if we have parking data - support both 'id' and '_id'
  const hasParkingData = selectedParking && (selectedParking.id || selectedParking._id)
  
  if (!selectedParking || !hasParkingData) {
    return (
      <div className="booking-details-container">
        <div className="loading-card">
          <h1>Loading...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="booking-details-container">
      <div className="booking-details-card">
        <div className="header-section">
          <button className="back-btn" onClick={() => navigate(`/slots/${selectedParking.id || selectedParking._id}`)}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <h1>🚗 Booking Details</h1>
          <p>Complete your parking reservation</p>
        </div>

        <div className="parking-summary">
          <div className="parking-info">
            <h3>📍 {selectedParking.name}</h3>
            <p><i className="fas fa-map-marker-alt"></i> {selectedParking.sector}</p>
            <p><i className="fas fa-car"></i> Slot: {selectedSlot.number || 'Auto-assigned'}</p>
            <p><i className="fas fa-tag"></i> PKR {selectedParking.price}/hour</p>
          </div>
          <div className="availability-info">
            <span className={`status-badge ${selectedParking.status}`}>
              {selectedParking.available} slots available
            </span>
          </div>
        </div>

        <form className="booking-form">
          <div className="form-section">
            <h3>👤 Personal Information</h3>
            
            <div className="form-group">
              <label htmlFor="userName">Full Name *</label>
              <input
                type="text"
                id="userName"
                name="userName"
                value={formData.userName}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required
              />
            </div>

            {/* ── Vehicle License Plate — auto-filled & locked if plate exists ── */}
            <div className="form-group">
              <label htmlFor="vehicleNumber">Vehicle License Plate *</label>
              <input
                type="text"
                id="vehicleNumber"
                name="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={plateIsLocked ? undefined : handleInputChange}
                placeholder={profileLoading ? 'Loading vehicle info...' : 'e.g., LEA-1234'}
                required
                readOnly={plateIsLocked}
                disabled={profileLoading}
                style={{
                  ...(plateIsLocked ? {
                    background: 'rgba(30, 41, 59, 0.5)',
                    color: '#94a3b8',
                    cursor: 'not-allowed',
                    borderColor: 'rgba(148, 163, 184, 0.2)'
                  } : {}),
                  ...(profileLoading ? { opacity: 0.5 } : {})
                }}
              />

              {/* Helper text shown when plate is locked */}
              {plateIsLocked && (
                <p style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <i className="fas fa-lock" style={{ fontSize: '10px', color: '#475569' }}></i>
                  Vehicle locked to your profile.{' '}
                  <span
                    onClick={() => navigate('/profile')}
                    style={{
                      color: '#60a5fa',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px'
                    }}
                  >
                    Update in Account Settings
                  </span>
                </p>
              )}

              {/* Format validation — only shown when field is editable */}
              {!plateIsLocked && formData.vehicleNumber && !/^[A-Za-z]{2,3}-\d{3,4}$/.test(formData.vehicleNumber) && (
                <span className="error-text" style={{ color: '#ef4444', fontSize: '13px', marginTop: '4px', display: 'block', fontWeight: '500' }}>
                  Invalid format. Use XXX-1234 (e.g. LEA-1234)
                </span>
              )}
            </div>
          </div>

          <div className="form-section">
            <h3>⏰ Booking Duration</h3>
            
            <div className="form-group">
              <label htmlFor="duration">Duration (Hours)</label>
              <select
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
              >
                {[1, 2, 3, 4, 5, 6, 12, 24].map(h => (
                  <option key={h} value={h}>{h} Hour{h > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="price-summary">
            <div className="price-row">
              <span>Base Price ({formData.duration} hour{formData.duration > 1 ? 's' : ''}):</span>
              <span>PKR {selectedParking.price * formData.duration}</span>
            </div>
            <div className="price-row total">
              <span><strong>Total Amount:</strong></span>
              <span className="amount">PKR {totalPrice}</span>
            </div>
          </div>

          <div className="form-section">
            <div className="terms-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleInputChange}
                />
                <span className="checkmark"></span>
                I agree to the <a href="#" onClick={(e) => e.preventDefault()}>Terms and Conditions</a> and <a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
              </label>
            </div>
          </div>

          <div className="action-buttons">
            <button 
              type="button" 
              className="btn-cancel"
              onClick={() => navigate('/map')}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-confirm"
              onClick={handleContinueToPayment}
              disabled={
                !formData.userName.trim() || 
                !formData.vehicleNumber.trim() || 
                !/^[A-Za-z]{2,3}-\d{3,4}$/.test(formData.vehicleNumber) || 
                !formData.agreeTerms
              }
              style={{
                opacity: (
                  !formData.userName.trim() || 
                  !formData.vehicleNumber.trim() || 
                  !/^[A-Za-z]{2,3}-\d{3,4}$/.test(formData.vehicleNumber) || 
                  !formData.agreeTerms
                ) ? 0.6 : 1,
                cursor: (
                  !formData.userName.trim() || 
                  !formData.vehicleNumber.trim() || 
                  !/^[A-Za-z]{2,3}-\d{3,4}$/.test(formData.vehicleNumber) || 
                  !formData.agreeTerms
                ) ? 'not-allowed' : 'pointer'
              }}
            >
              <i className="fas fa-credit-card"></i> Proceed to Payment
            </button>
          </div>
        </form>
      </div>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: 'info' })} 
      />
    </div>
  )
}

export default BookingDetails
