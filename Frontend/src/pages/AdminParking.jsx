import { useState, useEffect } from 'react'
import './AdminParking.css'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AdminParking = () => {
  const [parkingData, setParkingData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeParkingForSlots, setActiveParkingForSlots] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    sector: '',
    latitude: '',
    longitude: '',
    capacity: '',
    price: '',
    available: ''
  })
  const [toast, setToast] = useState({ message: '', type: 'info' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, parkingId: null })

  useEffect(() => {
    fetchParking()
  }, [])

  const fetchParking = async () => {
    try {
      const response = await fetch(`${API_URL}/api/parking`)
      const data = await response.json()
      setParkingData(Array.isArray(data) ? data : data.parking || [])
    } catch (error) {
      console.error('Error fetching parking:', error)
      setParkingData([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const method = editingItem ? 'PUT' : 'POST'
      const url = editingItem
        ? `${API_URL}/api/parking/${editingItem.id}`
        : `${API_URL}/api/parking`

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      setShowModal(false)
      setEditingItem(null)
      setFormData({
        name: '',
        sector: '',
        latitude: '',
        longitude: '',
        capacity: '',
        price: '',
        available: ''
      })
      fetchParking()
    } catch (error) {
      console.error('Error saving parking:', error)
    }
  }

  const handleEdit = (parking) => {
    setEditingItem(parking)
    setFormData({
      name: parking.name || '',
      sector: parking.sector || '',
      latitude: parking.latitude || '',
      longitude: parking.longitude || '',
      capacity: parking.capacity || '',
      price: parking.price || '',
      available: parking.available || ''
    })
    setShowModal(true)
  }

  const handleDeleteClick = (id) => {
    setConfirmModal({ isOpen: true, parkingId: id })
  }

  const handleDeleteConfirm = async () => {
    const id = confirmModal.parkingId
    setConfirmModal({ isOpen: false, parkingId: null })
    try {
      await fetch(`${API_URL}/api/parking/${id}`, { method: 'DELETE' })
      fetchParking()
    } catch (error) {
      console.error('Error deleting parking:', error)
    }
  }

  const openAddModal = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      sector: '',
      latitude: '',
      longitude: '',
      capacity: '',
      price: '',
      available: ''
    })
    setShowModal(true)
  }

  return (
    <div className="admin-parking">
      <div className="page-header">
        <div>
          <h2>Parking Management</h2>
          <p>Manage parking locations and slots</p>
        </div>
        <button className="btn-primary" onClick={openAddModal}>
          <i className="fas fa-plus"></i>
          Add Parking
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : parkingData.length > 0 ? (
        <div className="parking-grid">
          {parkingData.map((parking) => (
            <div key={parking.id} className="parking-card">
              <div className="parking-header">
                <h3>{parking.name}</h3>
                <span className={`status ${parking.available > 0 ? 'active' : 'full'}`}>
                  {parking.available > 0 ? 'Available' : 'Full'}
                </span>
              </div>
              <div className="parking-details">
                <p><i className="fas fa-location-dot"></i> {parking.sector}</p>
                <p><i className="fas fa-car"></i> {parking.available}/{parking.capacity} slots</p>
                <p><i className="fas fa-tag"></i> PKR {parking.price}/hour</p>
              </div>
              <div className="parking-actions">
                <button className="btn-slots" onClick={() => setActiveParkingForSlots(parking)} style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', color: '#06b6d4', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}>
                  <i className="fas fa-grip-horizontal"></i> Slots
                </button>
                <button className="btn-edit" onClick={() => handleEdit(parking)}>
                  <i className="fas fa-edit"></i> Edit
                </button>
                <button className="btn-delete" onClick={() => handleDeleteClick(parking.id)}>
                  <i className="fas fa-trash"></i> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-parking"></i>
          <p>No parking locations found</p>
          <button className="btn-primary" onClick={openAddModal}>Add First Parking</button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingItem ? 'Edit Parking' : 'Add New Parking'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Sector/Address</label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Total Capacity</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Available Slots</label>
                  <input
                    type="number"
                    value={formData.available}
                    onChange={(e) => setFormData({ ...formData, available: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Price per Hour (PKR)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? 'Update' : 'Add'} Parking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeParkingForSlots && (
        <SlotsModal 
          parking={activeParkingForSlots} 
          onClose={() => { setActiveParkingForSlots(null); fetchParking(); }} 
          setToast={setToast}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Parking Location"
        message="Are you sure you want to delete this parking location? This will also remove all slots associated with it."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, parkingId: null })}
        confirmText="Delete"
        type="danger"
      />
      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: 'info' })} 
      />
    </div>
  )
}

const SlotsModal = ({ parking, onClose, setToast }) => {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeActionSlot, setActiveActionSlot] = useState(null)
  const [bookingDetails, setBookingDetails] = useState(null)
  const [fetchingBooking, setFetchingBooking] = useState(false)

  useEffect(() => {
    fetchSlots()
  }, [])

  const fetchSlots = async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${apiBase}/api/parking/${parking.id}`)
      if (response.ok) {
        const data = await response.json()
        setSlots(data.slot_layouts || [])
      }
    } catch (error) {
      console.error('Error fetching slots:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleSlotStatus = async (slot, overrideStatus) => {
    const newStatus = overrideStatus || (slot.status === 'Out of Order' ? 'available' : 'Out of Order')
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${apiBase}/api/parking/${parking.id}/slots/${slot.number}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (response.ok) {
        fetchSlots()
        setToast({ message: `Slot ${slot.number} status updated to ${newStatus} successfully!`, type: 'success' })
      } else {
        setToast({ message: 'Failed to update slot status', type: 'error' })
      }
    } catch (error) {
      console.error('Error updating slot status:', error)
      setToast({ message: 'Network error updating slot', type: 'error' })
    }
  }

  const handleSlotClick = async (slot) => {
    setActiveActionSlot(slot)
    setBookingDetails(null)
    const isOutOfOrder = slot.status === 'Out of Order'
    const isBooked = slot.isBooked && !isOutOfOrder
    
    if (isBooked) {
      setFetchingBooking(true)
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
        const response = await fetch(`${apiBase}/api/parking/${parking.id}/slots/${slot.number}/booking`)
        if (response.ok) {
          const data = await response.json()
          setBookingDetails(data)
        }
      } catch (err) {
        console.error('Error fetching booking for slot:', err)
      } finally {
        setFetchingBooking(false)
      }
    }
  }

  const forceCancelBooking = async (bookingId) => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const response = await fetch(`${apiBase}/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      })
      
      if (response.ok) {
        fetchSlots()
        setToast({ message: `Booking #${bookingId} successfully force-cancelled!`, type: 'success' })
      } else {
        setToast({ message: 'Failed to cancel booking', type: 'error' })
      }
    } catch (error) {
      console.error('Error force cancelling booking:', error)
      setToast({ message: 'Network error cancelling booking', type: 'error' })
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h3>Manage Slots - {parking.name}</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '14px', lineHeight: '1.5' }}>
            Click on any slot tile below to inspect active reservations, cancel bookings, or toggle maintenance status.
          </p>

          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', display: 'inline-block' }}></span>
              <span>Available</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', display: 'inline-block' }}></span>
              <span>Booked</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.2)', border: '1px solid #64748b', display: 'inline-block' }}></span>
              <span>Out of Order</span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#38bdf8' }}>Loading slots...</div>
          ) : slots.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', maxHeight: '300px', overflowY: 'auto', padding: '5px' }}>
              {slots.map((slot) => {
                const isOutOfOrder = slot.status === 'Out of Order'
                const isBooked = slot.isBooked && !isOutOfOrder
                
                let tileBg = 'rgba(34, 197, 94, 0.1)'
                let tileBorder = '1px solid rgba(34, 197, 94, 0.3)'
                let tileColor = '#22c55e'

                if (isOutOfOrder) {
                  tileBg = 'rgba(100, 116, 139, 0.1)'
                  tileBorder = '1px solid rgba(100, 116, 139, 0.3)'
                  tileColor = '#94a3b8'
                } else if (isBooked) {
                  tileBg = 'rgba(239, 68, 68, 0.1)'
                  tileBorder = '1px solid rgba(239, 68, 68, 0.3)'
                  tileColor = '#ef4444'
                }

                return (
                  <div
                    key={slot.id}
                    onClick={() => handleSlotClick(slot)}
                    style={{
                      background: tileBg,
                      border: tileBorder,
                      color: tileColor,
                      padding: '12px 8px',
                      borderRadius: '8px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      userSelect: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,255,255,0.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {slot.isEV && <span style={{ marginRight: '2px' }}>⚡</span>}
                    {slot.number}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>No slot layouts defined for this parking location.</div>
          )}
        </div>
        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '15px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff' }}>Close</button>
        </div>
      </div>

      {activeActionSlot && (
        <div className="modal-overlay" onClick={() => setActiveActionSlot(null)} style={{ zIndex: 1100, background: 'rgba(11, 15, 25, 0.7)' }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '90%', background: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="modal-header">
              <h3>Slot {activeActionSlot.number} Actions</h3>
              <button className="modal-close" onClick={() => setActiveActionSlot(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Current Status:</span>
                <div>
                  {(() => {
                    const isOutOfOrder = activeActionSlot.status === 'Out of Order'
                    const isBooked = activeActionSlot.isBooked && !isOutOfOrder
                    if (isOutOfOrder) {
                      return <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(100, 116, 139, 0.15)', border: '1px solid #64748b', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>Out of Order</span>
                    } else if (isBooked) {
                      return <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>Booked</span>
                    } else {
                      return <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', fontSize: '12px', fontWeight: 'bold' }}>Available</span>
                    }
                  })()}
                </div>
              </div>

              {activeActionSlot.isBooked && !(activeActionSlot.status === 'Out of Order') && (
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>👤 Booking Details</h4>
                  {fetchingBooking ? (
                    <div style={{ color: '#38bdf8', fontSize: '13px' }}><i className="fas fa-spinner fa-spin"></i> Fetching booking information...</div>
                  ) : bookingDetails ? (
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#94a3b8' }}>
                      <div><strong>User Name:</strong> <span style={{ color: '#f8fafc' }}>{bookingDetails.user_name || 'N/A'}</span></div>
                      <div><strong>Email:</strong> <span style={{ color: '#f8fafc' }}>{bookingDetails.user_email || 'N/A'}</span></div>
                      <div><strong>Vehicle No:</strong> <span style={{ color: '#f8fafc' }}>{bookingDetails.vehicle_number || 'N/A'}</span></div>
                      <div><strong>Booking ID:</strong> <span style={{ color: '#f8fafc' }}>#{bookingDetails.booking_id || 'N/A'}</span></div>
                      <div><strong>Duration:</strong> <span style={{ color: '#f8fafc' }}>{bookingDetails.duration_hours || 'N/A'} Hour(s)</span></div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: '600', padding: '10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚠️ Orphaned booking detected. No user data found.</span>
                      </div>
                      <button 
                        onClick={() => { toggleSlotStatus(activeActionSlot, 'available'); setActiveActionSlot(null); }}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', fontSize: '13px' }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                      >
                        <i className="fas fa-screwdriver-wrench"></i> Force Mark Available
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!(activeActionSlot.status === 'Out of Order') && !activeActionSlot.isBooked && (
                  <button 
                    onClick={() => { toggleSlotStatus(activeActionSlot, 'Out of Order'); setActiveActionSlot(null); }}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  >
                    <i className="fas fa-ban"></i> Mark as Out of Order (Maintenance)
                  </button>
                )}

                {activeActionSlot.status === 'Out of Order' && (
                  <button 
                    onClick={() => { toggleSlotStatus(activeActionSlot, 'available'); setActiveActionSlot(null); }}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #22c55e, #15803d)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                  >
                    <i className="fas fa-circle-check"></i> Mark as Available
                  </button>
                )}

                {activeActionSlot.isBooked && !(activeActionSlot.status === 'Out of Order') && bookingDetails && (
                  <button 
                    onClick={() => { forceCancelBooking(bookingDetails.booking_id); setActiveActionSlot(null); }}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                  >
                    <i className="fas fa-circle-xmark"></i> Force Cancel Booking
                  </button>
                )}
                
                <button 
                  onClick={() => setActiveActionSlot(null)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(15, 23, 42, 0.4)', color: '#94a3b8', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminParking