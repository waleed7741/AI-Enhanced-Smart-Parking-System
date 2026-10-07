import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Payment.css'
import Toast from '../components/Toast'

const Payment = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [paymentMethod, setPaymentMethod] = useState('card')
  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState({ message: '', type: 'info' })

  // Get booking info from location state or localStorage
  const bookingInfo = location.state?.selectedParking
    ? location.state
    : JSON.parse(localStorage.getItem('bookingInfo') || '{}')

  const selectedParking = bookingInfo.selectedParking || {}
  const selectedSlot = bookingInfo.selectedSlot || {}
  const { userName, vehicleNumber, duration, totalPrice } = bookingInfo

  // Check if we have parking data
  const hasParkingData = selectedParking && (selectedParking.id || selectedParking._id || selectedParking.name)

  useEffect(() => {
    if (!hasParkingData) {
      navigate('/map')
    }
  }, [selectedParking, navigate])

  const handlePayment = async () => {
    setIsProcessing(true)
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    
    // Parse parking_id as a clean integer — backend requires integer for MongoDB lookup
    const rawParkingId = selectedParking.id || selectedParking._id
    const parkingId = rawParkingId ? parseInt(rawParkingId, 10) : null
    
    if (!parkingId || isNaN(parkingId)) {
      setToast({ message: 'Invalid parking location. Please go back and select a parking spot.', type: 'error' })
      setIsProcessing(false)
      return
    }
    
    // Construct real API booking payload
    const bookingPayload = {
      parking_id: parkingId,
      user_name: userName,
      user_email: localStorage.getItem('userEmail') || '',
      vehicle_number: vehicleNumber,
      duration_hours: duration,
      amount: totalPrice,
      // slot_id is the individual slot within the parking (NOT the parking_id)
      slot_number: selectedSlot.number || null
    }
    
    try {
      const response = await fetch(`${apiBase}/api/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingPayload)
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        const bookingData = {
          bookingId: data.booking_id || ('BK' + Date.now()),
          parkingId: selectedParking.id || selectedParking._id,
          parkingName: selectedParking.name,
          userName: userName,
          vehicleNumber: vehicleNumber,
          slotNumber: data.slot_number ? String(data.slot_number).replace('S-', '') : (selectedSlot.number ? String(selectedSlot.number).replace('S-', '') : 'Auto'),
          duration: duration,
          totalCost: totalPrice,
          bookingTime: new Date().toISOString(),
          remainingSlots: data.remaining_slots !== undefined ? data.remaining_slots : (selectedParking.available - 1)
        }
        
        localStorage.setItem('currentBooking', JSON.stringify(bookingData))
        // ── Persist active booking ID + location so Navbar can build Maps URL ──
        localStorage.setItem('activeBookingId', String(bookingData.bookingId))
        localStorage.setItem('activeParkingName', selectedParking.name || '')
        localStorage.setItem('activeParkingLat', selectedParking.latitude || selectedParking.lat || '')
        localStorage.setItem('activeParkingLng', selectedParking.longitude || selectedParking.lng || '')
        
        navigate('/booking-confirmed', {
          state: {
            booking: bookingData,
            success: true
          }
        })
      } else {
        setToast({ message: data.error || 'Booking failed on server. Please try again.', type: 'error' })
      }
    } catch (err) {
      console.warn('Backend not running, falling back to simulated booking:', err.message)
      // Dynamic fallback for offline/demo mode
      const bookingData = {
        bookingId: 'BK-DEMO-' + Date.now(),
        parkingId: selectedParking.id || selectedParking._id,
        parkingName: selectedParking.name,
        userName: userName,
        vehicleNumber: vehicleNumber,
        slotNumber: selectedSlot.number ? String(selectedSlot.number).replace('S-', '') : 'Auto',
        duration: duration,
        totalCost: totalPrice,
        bookingTime: new Date().toISOString(),
        remainingSlots: (selectedParking.available || 10) - 1
      }
      localStorage.setItem('currentBooking', JSON.stringify(bookingData))
      // ── Persist for offline/demo mode too ──
      localStorage.setItem('activeBookingId', String(bookingData.bookingId))
      localStorage.setItem('activeParkingName', selectedParking.name || '')
      localStorage.setItem('activeParkingLat', selectedParking.latitude || selectedParking.lat || '')
      localStorage.setItem('activeParkingLng', selectedParking.longitude || selectedParking.lng || '')
      navigate('/booking-confirmed', {
        state: {
          booking: bookingData,
          success: true
        }
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!hasParkingData) {
    return (
      <div className="payment-container">
        <div className="payment-card">
          <h2>No booking information</h2>
          <button onClick={() => navigate('/map')}>Go to Map</button>
        </div>
      </div>
    )
  }

  return (
    <div className="payment-container">
      <div className="payment-card">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i> Back
        </button>

        <div className="payment-header">
          <h1>Payment</h1>
          <p>Complete your payment to reserve your slot</p>
        </div>

        <div className="payment-summary">
          <h3>Order Summary</h3>
          <div className="summary-row">
            <span>Parking:</span>
            <span>{selectedParking.name}</span>
          </div>
          <div className="summary-row">
            <span>Slot:</span>
            <span>{selectedSlot.number || 'Auto-assigned'}</span>
          </div>
          <div className="summary-row">
            <span>Vehicle:</span>
            <span>{vehicleNumber}</span>
          </div>
          <div className="summary-row">
            <span>Duration:</span>
            <span>{duration} hour(s)</span>
          </div>
          <div className="summary-row total">
            <span><strong>Total Amount:</strong></span>
            <span className="amount">PKR {totalPrice}</span>
          </div>
        </div>

        <div className="payment-methods">
          <h3>Select Payment Method</h3>

          <div className={`method-option ${paymentMethod === 'card' ? 'selected' : ''}`}
               onClick={() => setPaymentMethod('card')}>
            <input type="radio" name="payment" checked={paymentMethod === 'card'} readOnly />
            <i className="fas fa-credit-card"></i>
            <div className="method-info">
              <span className="method-name">Credit/Debit Card</span>
              <span className="method-desc">Pay with Visa, Mastercard, etc.</span>
            </div>
          </div>

          <div className={`method-option ${paymentMethod === 'easypaisa' ? 'selected' : ''}`}
               onClick={() => setPaymentMethod('easypaisa')}>
            <input type="radio" name="payment" checked={paymentMethod === 'easypaisa'} readOnly />
            <i className="fas fa-mobile-alt"></i>
            <div className="method-info">
              <span className="method-name">JazzCash / EasyPaisa</span>
              <span className="method-desc">Mobile wallet payment</span>
            </div>
          </div>

          <div className={`method-option ${paymentMethod === 'bank' ? 'selected' : ''}`}
               onClick={() => setPaymentMethod('bank')}>
            <input type="radio" name="payment" checked={paymentMethod === 'bank'} readOnly />
            <i className="fas fa-university"></i>
            <div className="method-info">
              <span className="method-name">Bank Transfer</span>
              <span className="method-desc">Direct bank payment</span>
            </div>
          </div>
        </div>

        {paymentMethod === 'card' && (
          <div className="card-form">
            <div className="form-group">
              <label>Card Number</label>
              <input type="text" placeholder="1234 5678 9012 3456" maxLength="19" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Expiry Date</label>
                <input type="text" placeholder="MM/YY" maxLength="5" />
              </div>
              <div className="form-group">
                <label>CVV</label>
                <input type="text" placeholder="123" maxLength="3" />
              </div>
            </div>
            <div className="form-group">
              <label>Cardholder Name</label>
              <input type="text" placeholder="John Doe" />
            </div>
          </div>
        )}

        {paymentMethod === 'easypaisa' && (
          <div className="easypaisa-info">
            <p>You will receive an SMS with payment instructions.</p>
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="tel" placeholder="03XX-XXXXXXX" />
            </div>
          </div>
        )}

        <div className="payment-actions">
          <button className="btn-cancel" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button
            className="btn-pay"
            onClick={handlePayment}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Processing...
              </>
            ) : (
              <>
                <i className="fas fa-lock"></i> Pay PKR {totalPrice}
              </>
            )}
          </button>
        </div>

        <div className="secure-notice">
          <i className="fas fa-shield-alt"></i>
          <span>Your payment is secure and encrypted</span>
        </div>
      </div>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: 'info' })} 
      />
    </div>
  )
}

export default Payment