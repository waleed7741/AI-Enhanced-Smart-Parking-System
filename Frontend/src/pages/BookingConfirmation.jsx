import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import './BookingConfirmation.css'

const BookingConfirmation = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get booking data from navigation state or localStorage
  const bookingData = location.state?.booking || JSON.parse(localStorage.getItem('currentBooking') || '{}')
  const isSuccess = location.state?.success || false
  
  useEffect(() => {
    // If no booking data, redirect to home
    if (!bookingData || !bookingData.bookingId) {
      navigate('/')
    }
  }, [bookingData, navigate])

  const handleFinish = () => {
    // Clean up temporary booking state so next booking starts fresh
    localStorage.removeItem('bookingInfo')
    localStorage.removeItem('selectedParking')
    localStorage.removeItem('selectedSlot')
    navigate('/map')
  }

  if (!bookingData || !bookingData.bookingId) {
    return <div className="confirmation-container">
      <div className="confirmation-card">
        <h1>Loading...</h1>
      </div>
    </div>
  }

  return (
    <div className="confirmation-container">
      <div className="confirmation-card">
        <div className="icon-box success">
          <i className="fas fa-check-circle"></i>
        </div>
        <h1>Booking Successful!</h1>
        <p>Your parking slot has been confirmed</p>
        
        <div className="summary-box">
          <h3>🎫 Booking Details</h3>
          <p><strong>Booking ID:</strong> {bookingData.bookingId}</p>
          <p><strong>Parking:</strong> {bookingData.parkingName}</p>
          <p><strong>Slot Number:</strong> S-{bookingData.slotNumber}</p>
          <p><strong>User:</strong> {bookingData.userName}</p>
          <p><strong>Vehicle:</strong> {bookingData.vehicleNumber}</p>
          <p><strong>Duration:</strong> {bookingData.duration} hour(s)</p>
          <p><strong>Total Cost:</strong> PKR {bookingData.totalCost}</p>
          <p><strong>Booking Time:</strong> {new Date(bookingData.bookingTime).toLocaleString()}</p>
        </div>

        <div className="action-buttons">
          <button className="btn-primary" onClick={handleFinish} id="btn-finish-booking">
            <i className="fas fa-check-circle"></i> Finish
          </button>
          <button className="btn-secondary" onClick={() => navigate('/navigation')}>
            <i className="fas fa-directions"></i> Get Directions
          </button>
        </div>

        <div className="info-box">
          <p><strong>📧 Confirmation sent to:</strong> {bookingData.userName}</p>
          <p><strong>📍 Parking Location:</strong> {bookingData.parkingName}</p>
          <p><strong>⏰ Please arrive within 15 minutes</strong></p>
        </div>
      </div>
    </div>
  )
}

export default BookingConfirmation
