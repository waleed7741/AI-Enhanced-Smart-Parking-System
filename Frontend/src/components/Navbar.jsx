import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Navbar.css'
import { auth } from '../firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [activeBookingId, setActiveBookingId] = useState(() => localStorage.getItem('activeBookingId') || null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('userEmail', currentUser.email || '')
        localStorage.setItem('userName', currentUser.displayName || currentUser.email?.split('@')[0] || '')
      } else {
        localStorage.removeItem('isLoggedIn')
        localStorage.removeItem('userToken')
        localStorage.removeItem('userEmail')
        localStorage.removeItem('userName')
      }
    })
    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setIsDropdownOpen(false)
      setIsMobileMenuOpen(false)
      navigate('/')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest('.user-avatar-container')) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('click', closeDropdown)
    return () => document.removeEventListener('click', closeDropdown)
  }, [])

  // Re-check localStorage for active booking whenever the route changes
  useEffect(() => {
    setActiveBookingId(localStorage.getItem('activeBookingId') || null)
  }, [location.pathname])

  const isActive = (path) => location.pathname === path

  return (
    <>
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="navbar-container">
          <Link to="/" className="navbar-logo">
            <i className="fas fa-square-parking"></i>
            <span>Smart Parking</span>
          </Link>

          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>

          <ul className={`navbar-menu ${isMobileMenuOpen ? 'active' : ''}`}>
            <li>
              <Link
                to="/"
                className={isActive('/') ? 'active' : ''}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-house"></i>
                Home
              </Link>
            </li>
            <li>
              <Link
                to="/map"
                className={isActive('/map') ? 'active' : ''}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-map-location-dot"></i>
                Map
              </Link>
            </li>
            <li>
              <Link
                to="/list"
                className={isActive('/list') ? 'active' : ''}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-list-check"></i>
                Parking List
              </Link>
            </li>
            <li>
              <Link
                to="/dashboard"
                className={isActive('/dashboard') ? 'active' : ''}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-chart-pie"></i>
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                to="/contact"
                className={isActive('/contact') ? 'active' : ''}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-headset"></i>
                Contact
              </Link>
            </li>
            <li>
              <Link
                to="/admin"
                className={location.pathname.startsWith('/admin') ? 'active' : ''}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <i className="fas fa-user-gear"></i>
                Admin
              </Link>
            </li>

            {user ? (
              <li className="user-avatar-container">
                <button
                  className="user-avatar-btn"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="user-avatar-img" />
                  ) : (
                    <div className="user-avatar-placeholder">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
                {isDropdownOpen && (
                  <div className="user-dropdown-menu">
                    <div className="user-dropdown-header">
                      <span className="user-email">{user.email}</span>
                    </div>
                    <div className="user-dropdown-divider"></div>
                    <Link
                      to="/profile"
                      className="user-dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <i className="fas fa-user"></i>
                      My Profile
                    </Link>
                    <div className="user-dropdown-divider"></div>
                    <button
                      className="user-dropdown-item logout-btn"
                      onClick={handleLogout}
                    >
                      <i className="fas fa-right-from-bracket"></i>
                      Logout
                    </button>
                  </div>
                )}
              </li>
            ) : (
              <li className="auth-cta">
                <Link
                  to="/login"
                  className={`login-link ${isActive('/login') ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <i className="fas fa-right-to-bracket"></i>
                  Login
                </Link>
              </li>
            )}
          </ul>
        </div>
      </nav>

      {/* ── Active Session Resume Banner ────────────────────────────────────── */}
      {activeBookingId && !location.pathname.startsWith('/booking/active') && (
        <div style={{
          position: 'fixed', top: '64px', left: 0, right: 0, zIndex: 999,
          background: 'linear-gradient(90deg, rgba(22,163,74,0.95), rgba(15,118,110,0.95))',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(74,222,128,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '14px', padding: '9px 20px',
          boxShadow: '0 4px 20px rgba(22,163,74,0.3)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d1fae5', fontSize: '13px', fontWeight: '600' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', display: 'inline-block', animation: 'navPulse 1.5s infinite' }}></span>
            Active parking session in progress
          </span>

          <button
            onClick={() => navigate('/navigation')}
            style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', padding: '5px 14px', borderRadius: '20px',
              cursor: 'pointer', fontSize: '12px', fontWeight: '700', letterSpacing: '0.02em'
            }}
          >
            <i className="fas fa-arrow-right" style={{ marginRight: '5px' }}></i>Resume Session
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('activeBookingId')
              localStorage.removeItem('activeParkingLat')
              localStorage.removeItem('activeParkingLng')
              localStorage.removeItem('activeParkingName')
              setActiveBookingId(null)
            }}
            style={{
              background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontSize: '15px', padding: '2px 6px'
            }}
            title="Dismiss"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
      <style>{`@keyframes navPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.25)} }`}</style>
    </>
  )
}

export default Navbar