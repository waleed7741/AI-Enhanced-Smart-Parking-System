import { useState, useEffect } from 'react'
import './AdminSettings.css'
import Toast from '../components/Toast'

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    hourlyRate: 50,
    maxBookingHours: 8,
    workingHoursStart: '08:00',
    workingHoursEnd: '22:00',
    minAdvanceBooking: 1,
    cancellationHours: 2,
    notifications: {
      email: true,
      sms: false,
      push: true
    }
  })

  const [parkingLots, setParkingLots] = useState([])
  const [selectedParkingId, setSelectedParkingId] = useState('')
  const [selectedParkingRate, setSelectedParkingRate] = useState(80)
  const [toast, setToast] = useState({ message: '', type: 'info' })

  useEffect(() => {
    fetchSettings()
    fetchParkingLots()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/settings`)
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const fetchParkingLots = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/parking`)
      if (response.ok) {
        const data = await response.json()
        setParkingLots(data)
        if (data.length > 0) {
          setSelectedParkingId(data[0].id)
          setSelectedParkingRate(data[0].hourlyRate || data[0].price || 80)
        }
      }
    } catch (error) {
      console.error('Error fetching parking lots:', error)
    }
  }

  const handleParkingSelection = (id) => {
    setSelectedParkingId(id)
    const lot = parkingLots.find(l => l.id === id)
    if (lot) {
      setSelectedParkingRate(lot.hourlyRate || lot.price || 80)
    }
  }

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleNotificationChange = (type) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type]
      }
    }))
  }

  const handleSave = async () => {
    try {
      // 1. Save general settings
      const settingsResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      
      // 2. Save location-specific rate if a location is selected
      let rateSaved = true
      if (selectedParkingId) {
        const rateResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/parking/${selectedParkingId}/rate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hourlyRate: selectedParkingRate })
        })
        if (!rateResponse.ok) {
          rateSaved = false
        } else {
          // Update local parking list rate so it stays current
          setParkingLots(prev => prev.map(lot => lot.id === selectedParkingId ? { ...lot, hourlyRate: selectedParkingRate, price: selectedParkingRate } : lot))
        }
      }

      if (settingsResponse.ok && rateSaved) {
        setToast({ message: 'Settings and location parking rate saved successfully!', type: 'success' })
      } else if (settingsResponse.ok) {
        setToast({ message: 'General settings saved, but location rate update failed.', type: 'warning' })
      } else {
        setToast({ message: 'Failed to save system settings.', type: 'error' })
      }
    } catch (err) {
      console.error('Error saving settings:', err)
      setToast({ message: 'Error connecting to backend settings API', type: 'error' })
    }
  }

  const handleBackup = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/backup`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
    } catch (error) {
      console.error('Backup failed:', error)
      setToast({ message: 'Backup feature requires backend connection', type: 'error' })
    }
  }

  return (
    <div className="admin-settings">
      <div className="page-header">
        <h2>Settings</h2>
        <p>Configure system settings and preferences</p>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <h3><i className="fas fa-coins"></i> Pricing & Booking</h3>
          
          <div className="setting-item">
            <label>Select Parking Location</label>
            <select
              value={selectedParkingId}
              onChange={(e) => handleParkingSelection(parseInt(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            >
              <option value="">-- Choose Location --</option>
              {parkingLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name} ({lot.sector})
                </option>
              ))}
            </select>
          </div>

          {selectedParkingId && (
            <div className="setting-item">
              <label>Location Hourly Rate (PKR)</label>
              <input
                type="number"
                value={selectedParkingRate}
                onChange={(e) => setSelectedParkingRate(parseInt(e.target.value) || 0)}
              />
            </div>
          )}

          <div className="setting-item">
            <label>Max Booking Hours</label>
            <input
              type="number"
              value={settings.maxBookingHours}
              onChange={(e) => handleChange('maxBookingHours', e.target.value)}
            />
          </div>
          <div className="setting-item">
            <label>Min Advance Booking (hours)</label>
            <input
              type="number"
              value={settings.minAdvanceBooking}
              onChange={(e) => handleChange('minAdvanceBooking', e.target.value)}
            />
          </div>
          <div className="setting-item">
            <label>Cancellation Policy (hours notice)</label>
            <input
              type="number"
              value={settings.cancellationHours}
              onChange={(e) => handleChange('cancellationHours', e.target.value)}
            />
          </div>
        </div>

        <div className="settings-card">
          <h3><i className="fas fa-clock"></i> Working Hours</h3>
          <div className="setting-item">
            <label>Start Time</label>
            <input
              type="time"
              value={settings.workingHoursStart}
              onChange={(e) => handleChange('workingHoursStart', e.target.value)}
            />
          </div>
          <div className="setting-item">
            <label>End Time</label>
            <input
              type="time"
              value={settings.workingHoursEnd}
              onChange={(e) => handleChange('workingHoursEnd', e.target.value)}
            />
          </div>
        </div>

        <div className="settings-card">
          <h3><i className="fas fa-bell"></i> Notifications</h3>
          <div className="setting-item toggle">
            <label>Email Notifications</label>
            <button
              className={`toggle-btn ${settings.notifications.email ? 'active' : ''}`}
              onClick={() => handleNotificationChange('email')}
            >
              <span className="toggle-slider"></span>
            </button>
          </div>
          <div className="setting-item toggle">
            <label>SMS Notifications</label>
            <button
              className={`toggle-btn ${settings.notifications.sms ? 'active' : ''}`}
              onClick={() => handleNotificationChange('sms')}
            >
              <span className="toggle-slider"></span>
            </button>
          </div>
          <div className="setting-item toggle">
            <label>Push Notifications</label>
            <button
              className={`toggle-btn ${settings.notifications.push ? 'active' : ''}`}
              onClick={() => handleNotificationChange('push')}
            >
              <span className="toggle-slider"></span>
            </button>
          </div>
        </div>

        <div className="settings-card">
          <h3><i className="fas fa-database"></i> Data Management</h3>
          <div className="setting-item">
            <button className="action-btn" onClick={handleBackup}>
              <i className="fas fa-download"></i>
              Download Backup
            </button>
          </div>
          <div className="setting-item danger">
            <button className="action-btn danger">
              <i className="fas fa-trash-alt"></i>
              Clear All Bookings
            </button>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSave}>
          <i className="fas fa-save"></i>
          Save Settings
        </button>
      </div>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        onClose={() => setToast({ message: '', type: 'info' })} 
      />
    </div>
  )
}

export default AdminSettings