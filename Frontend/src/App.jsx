import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import AdminLayout from './components/AdminLayout'
import AdminRoute from './components/AdminRoute'
import './App.css'

// Lazy load components for better performance
const Home = lazy(() => import('./pages/Home'))
const MapView = lazy(() => import('./pages/MapView'))
const ParkingList = lazy(() => import('./pages/ParkingList'))
const SlotSelection = lazy(() => import('./pages/SlotSelection'))
const Auth = lazy(() => import('./pages/Auth'))
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'))
const BookingDetails = lazy(() => import('./pages/BookingDetails'))
const Payment = lazy(() => import('./pages/Payment'))
const Navigation = lazy(() => import('./pages/Navigation'))
const Contact = lazy(() => import('./pages/Contact'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
// Admin pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminParking = lazy(() => import('./pages/AdminParking'))
const AdminBookings = lazy(() => import('./pages/AdminBookings'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminMessages = lazy(() => import('./pages/AdminMessages'))
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics'))
const AdminML = lazy(() => import('./pages/AdminML'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))

// Loading component
const PageLoader = () => (
  <div style={{ 
    height: '100vh', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center',
    background: '#0f172a',
    color: '#38bdf8'
  }}>
    <div className="loader">Loading...</div>
  </div>
)

/**
 * BannerSpacer — sits in the normal document flow right after the fixed Navbar.
 * When the green active-session banner is visible (activeBookingId in localStorage),
 * it expands to 40px to push page content below the banner.
 * When no session is active it collapses to 0px — no layout impact.
 * Must live inside <Router> to call useLocation.
 */
const BannerSpacer = () => {
  const location = useLocation()
  const [hasBanner, setHasBanner] = useState(() => !!localStorage.getItem('activeBookingId'))

  // Re-read localStorage on every route change (mirrors Navbar's own sync)
  useEffect(() => {
    setHasBanner(!!localStorage.getItem('activeBookingId'))
  }, [location.pathname])

  return (
    <div
      aria-hidden="true"
      style={{
        height: hasBanner ? '40px' : '0px',
        transition: 'height 0.25s ease',
        flexShrink: 0,
        pointerEvents: 'none'
      }}
    />
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App page-transition">
          <Navbar />
          {/* Spacer: pushes content down by the banner height when a session is active */}
          <BannerSpacer />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/list" element={<ParkingList />} />
              <Route path="/slots/:id" element={<SlotSelection />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/register" element={<Auth />} />
              <Route path="/confirm" element={<BookingConfirmation />} />
              <Route path="/booking-confirmed" element={<BookingConfirmation />} />
              <Route path="/booking-details" element={<BookingDetails />} />
              <Route path="/payment" element={<Payment />} />
              <Route path="/navigation" element={<Navigation />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="parking" element={<AdminParking />} />
                  <Route path="bookings" element={<AdminBookings />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="ml" element={<AdminML />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App
