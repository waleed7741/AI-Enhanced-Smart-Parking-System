import { Link, Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './AdminLayout.css'
import io from 'socket.io-client'
import Toast from './Toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const socket = io(API_URL)

const AdminLayout = () => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

  const playNotificationSound = (type = 'new') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'new') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6
      } else {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.2); // A4
      }

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) { console.log("Audio not supported or blocked", e); }
  };

  useEffect(() => {
    // Listen for 'new_booking' WebSockets events globally across the Admin Panel
    socket.on('new_booking', (data) => {
      console.log("[WS Global] New booking received event:", data)
      playNotificationSound('new');
      
      // Fire a custom window event to silently notify active tab panels (e.g. AdminBookings)
      window.dispatchEvent(new Event('new-booking-received'));

      if (window.toastTimeout) clearTimeout(window.toastTimeout);

      setToast({
        show: true,
        message: `🔔 New Booking Received: Slot ${data.slot_number || 'N/A'} booked!`,
        type: 'success'
      });

      // Auto-hide toast after 6 seconds
      window.toastTimeout = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 6000);
    })

    // Listen for 'booking_finished' WebSockets events globally across the Admin Panel
    socket.on('booking_finished', (data) => {
      console.log("[WS Global] Booking finished event:", data)
      playNotificationSound('finish');

      // Fire a custom window event to silently notify active tab panels (e.g. AdminBookings)
      window.dispatchEvent(new Event('booking-finished-received'));

      if (window.toastTimeout) clearTimeout(window.toastTimeout);

      setToast({
        show: true,
        message: `🟢 User reached destination & finished parking!`,
        type: 'success'
      });

      // Auto-hide toast after 6 seconds
      window.toastTimeout = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 6000);
    })

    return () => {
      socket.off('new_booking')
      socket.off('booking_finished')
      if (window.toastTimeout) clearTimeout(window.toastTimeout);
    }
  }, [])
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(localStorage.getItem('isAdminLoggedIn') === 'true')
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [error, setError] = useState('')

  const handleAdminLogin = (e) => {
    e.preventDefault()
    if (adminUsername.trim().toLowerCase() === 'admin@smartparking.pk' && adminPassword === 'SmartParkAdmin2026!') {
      localStorage.setItem('isAdminLoggedIn', 'true')
      setIsAdminLoggedIn(true)
      setError('')
    } else {
      setError('Invalid Admin Credentials!')
    }
  }

  const handleAdminLogout = () => {
    localStorage.removeItem('isAdminLoggedIn')
    setIsAdminLoggedIn(false)
    setAdminUsername('')
    setAdminPassword('')
  }

  const menuItems = [
    { path: '/admin', icon: 'fa-gauge-high', label: 'Dashboard', exact: true },
    { path: '/admin/parking', icon: 'fa-parking', label: 'Parking Management' },
    { path: '/admin/bookings', icon: 'fa-calendar-check', label: 'Bookings' },
    { path: '/admin/users', icon: 'fa-users', label: 'Users' },
    { path: '/admin/messages', icon: 'fa-envelope-open-text', label: 'Inquiries' },
    { path: '/admin/analytics', icon: 'fa-chart-line', label: 'Analytics' },
    { path: '/admin/ml', icon: 'fa-brain', label: 'AI/ML Model' },
    { path: '/admin/settings', icon: 'fa-gear', label: 'Settings' },
  ]

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  if (!isAdminLoggedIn) {
    return (
      <div className="admin-login-overlay">
        <div className="admin-login-card">
          <div className="admin-login-icon">
            <i className="fas fa-shield-halved"></i>
          </div>
          <h2>Admin Portal Access</h2>
          <p>Please authorize yourself to continue to the dashboard.</p>
          
          <form onSubmit={handleAdminLogin}>
            {error && (
              <div className="admin-login-error">
                <i className="fas fa-circle-exclamation"></i> {error}
              </div>
            )}
            
            <div className="admin-form-group">
              <label>Administrator Email</label>
              <div className="input-with-icon">
                <i className="fas fa-envelope"></i>
                <input 
                  type="email" 
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin@smartparking.pk"
                  required 
                />
              </div>
            </div>

            <div className="admin-form-group">
              <label>Security Password</label>
              <div className="input-with-icon">
                <i className="fas fa-lock"></i>
                <input 
                  type={showAdminPassword ? "text" : "password"} 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required 
                  style={{ paddingRight: '45px' }}
                />
                <span 
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  style={{ 
                    position: 'absolute', 
                    right: '16px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    cursor: 'pointer', 
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'color 0.2s',
                    zIndex: 10
                  }}
                >
                  <i 
                    className={`fas ${showAdminPassword ? 'fa-eye-slash' : 'fa-eye'}`} 
                    style={{ position: 'static', transform: 'none', color: 'inherit', fontSize: '15px' }}
                  ></i>
                </span>
              </div>
            </div>

            <button type="submit" className="admin-login-btn">
              <i className="fas fa-sign-in-alt"></i> Verify & Authenticate
            </button>
          </form>

          <Link to="/" className="admin-login-back">
            <i className="fas fa-arrow-left"></i> Return to Main Website
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <i className="fas fa-shield-halved"></i>
            <span>Admin Panel</span>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <i className={`fas ${sidebarOpen ? 'fa-angle-left' : 'fa-angle-right'}`}></i>
          </button>
        </div>
        <ul className="admin-menu">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={isActive(item.path, item.exact) ? 'active' : ''}
              >
                <i className={`fas ${item.icon}`}></i>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="admin-sidebar-footer">
          <Link to="/" className="back-to-site">
            <i className="fas fa-arrow-left"></i>
            <span>Back to Site</span>
          </Link>
        </div>
      </aside>
      <main className="admin-content">
        <header className="admin-header">
          <div className="admin-header-left">
            <h1>Smart Parking Admin</h1>
          </div>
          <div className="admin-header-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span className="admin-welcome"><i className="fas fa-user-shield"></i> Welcome, Admin</span>
            <button 
              onClick={handleAdminLogout} 
              className="admin-logout-btn"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              <i className="fas fa-right-from-bracket"></i> Logout
            </button>
          </div>
        </header>
        <div className="admin-body">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default AdminLayout