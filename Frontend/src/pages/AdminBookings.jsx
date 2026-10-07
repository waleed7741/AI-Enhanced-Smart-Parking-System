import { useState, useEffect } from 'react'
import './AdminBookings.css'
import ConfirmModal from '../components/ConfirmModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AdminBookings = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, bookingId: null })

  useEffect(() => {
    fetchBookings()

    const handleRefresh = () => {
      console.log("[WS UI Sync] WebSocket trigger detected, refetching bookings...")
      fetchBookings()
    }

    window.addEventListener('new-booking-received', handleRefresh)
    window.addEventListener('booking-finished-received', handleRefresh)

    return () => {
      window.removeEventListener('new-booking-received', handleRefresh)
      window.removeEventListener('booking-finished-received', handleRefresh)
    }
  }, [])

  const fetchBookings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bookings`)
      const data = await response.json()
      setBookings(Array.isArray(data) ? data : data.bookings || [])
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      fetchBookings()
    } catch (error) {
      console.error('Error updating booking:', error)
    }
  }

  const handleDeleteClick = (id) => {
    setConfirmModal({ isOpen: true, bookingId: id })
  }

  const handleDeleteConfirm = async () => {
    const id = confirmModal.bookingId
    setConfirmModal({ isOpen: false, bookingId: null })
    try {
      await fetch(`${API_URL}/api/bookings/${id}`, { method: 'DELETE' })
      fetchBookings()
    } catch (error) {
      console.error('Error deleting booking:', error)
    }
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesFilter = filter === 'all' || booking.status === filter
    const matchesSearch = searchTerm === '' ||
      (booking.user_name && booking.user_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (booking.parking_name && booking.parking_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (booking.booking_id && String(booking.booking_id).includes(searchTerm)) ||
      (booking.vehicle_number && booking.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesFilter && matchesSearch
  })

  const exportToCSV = () => {
    const headers = ['Booking ID', 'User', 'Parking', 'Slot', 'Vehicle No.', 'Date', 'Time', 'Duration', 'Status', 'Amount']
    const rows = filteredBookings.map(b => [
      b.booking_id,
      b.user_name || 'N/A',
      b.parking_name || 'N/A',
      b.slot_number || b.slotId || 'N/A',
      b.vehicle_number || b.vehicleNumber || 'N/A',
      b.booking_time ? new Date(b.booking_time).toLocaleDateString() : 'N/A',
      b.booking_time ? new Date(b.booking_time).toLocaleTimeString() : 'N/A',
      b.duration_hours ? `${b.duration_hours}h` : 'N/A',
      b.status || 'N/A',
      b.total_cost || 0
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bookings.csv'
    a.click()
  }

  const getStatusBadge = (status) => {
    const classes = {
      active: 'badge-success',
      completed: 'badge-info',
      cancelled: 'badge-danger',
      pending: 'badge-warning'
    }
    return classes[status] || 'badge-info'
  }

  return (
    <div className="admin-bookings">
      <div className="page-header">
        <div>
          <h2>Bookings Management</h2>
          <p>View and manage all parking bookings</p>
        </div>
        <button className="btn-secondary" onClick={exportToCSV}>
          <i className="fas fa-download"></i>
          Export CSV
        </button>
        <button className="btn-secondary" onClick={fetchBookings} style={{ marginLeft: '8px' }}>
          <i className="fas fa-rotate"></i>
          Refresh
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search by user, parking, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
          <button
            className={`filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setFilter('cancelled')}
          >
            Cancelled
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : filteredBookings.length > 0 ? (
        <div className="table-container">
          <table className="bookings-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>User</th>
                <th>Parking</th>
                <th>Slot</th>
                <th>Vehicle No.</th>
                <th>Date</th>
                <th>Time</th>
                <th>Duration</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking) => (
                <tr key={booking.booking_id}>
                  <td className="booking-id">#{booking.booking_id || 'N/A'}</td>
                  <td>{booking.user_name || 'N/A'}</td>
                  <td>{booking.parking_name || 'N/A'}</td>
                  <td>{booking.slot_number || booking.slotId || 'N/A'}</td>
                  <td>{booking.vehicle_number || booking.vehicleNumber || 'N/A'}</td>
                  <td>{booking.booking_time ? new Date(booking.booking_time).toLocaleDateString() : 'N/A'}</td>
                  <td>{booking.booking_time ? new Date(booking.booking_time).toLocaleTimeString() : 'N/A'}</td>
                  <td>{booking.duration_hours ? `${booking.duration_hours}h` : 'N/A'}</td>
                  <td className="amount">PKR {booking.total_cost || 0}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(booking.status)}`}>
                      {booking.status || 'unknown'}
                    </span>
                  </td>
                  <td className="actions">
                    {booking.status === 'confirmed' && (
                      <>
                        <button
                          className="action-btn complete"
                          onClick={() => updateStatus(booking.booking_id, 'completed')}
                          title="Mark Complete"
                        >
                          <i className="fas fa-check"></i>
                        </button>
                        <button
                          className="action-btn cancel"
                          onClick={() => updateStatus(booking.booking_id, 'cancelled')}
                          title="Cancel"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </>
                    )}
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteClick(booking.booking_id)}
                      title="Delete"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-calendar-xmark"></i>
          <p>No bookings found</p>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Booking"
        message="Are you sure you want to delete this parking booking record? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, bookingId: null })}
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}

export default AdminBookings