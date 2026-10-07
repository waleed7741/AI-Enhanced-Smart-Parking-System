import { useState, useEffect } from 'react'
import './AdminDashboard.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalParking: 0,
    totalBookings: 0,
    totalUsers: 0,
    revenue: 0,
    activeBookings: 0
  })
  const [recentBookings, setRecentBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    // Poll every 5 seconds for robust real-time updates
    const interval = setInterval(fetchDashboardData, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Use the consolidated /api/stats endpoint for atomic, fast fetch
      const statsRes = await fetch(`${API_URL}/api/stats`)
      const statsData = await statsRes.json()

      if (statsRes.ok && !statsData.error) {
        setStats({
          totalParking: statsData.total_parking,
          totalBookings: statsData.total_bookings,
          totalUsers: statsData.total_users,
          revenue: statsData.total_revenue || 0,
          activeBookings: statsData.active_bookings
        })
        setRecentBookings(statsData.recent_bookings || [])
      } else {
        // Fallback to individual calls if /api/stats not available
        const [parkingRes, bookingsRes, usersRes] = await Promise.all([
          fetch(`${API_URL}/api/parking`),
          fetch(`${API_URL}/api/bookings`),
          fetch(`${API_URL}/api/users`)
        ])
        const parkingData = await parkingRes.json()
        const bookingsData = await bookingsRes.json()
        const usersData = await usersRes.json()

        const bookings = Array.isArray(bookingsData) ? bookingsData : bookingsData.bookings || []
        const users = Array.isArray(usersData) ? usersData : usersData.users || []
        const parking = Array.isArray(parkingData) ? parkingData : parkingData.parking || []
        const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'active').length

        setStats({
          totalParking: parking.length,
          totalBookings: bookings.length,
          totalUsers: users.length,
          revenue: bookings.reduce((acc, b) => acc + (b.total_cost || b.totalPrice || 0), 0),
          activeBookings
        })
        const sortedBookings = [...bookings].sort((a, b) => (b.booking_id || 0) - (a.booking_id || 0))
        setRecentBookings(sortedBookings.slice(0, 5))
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setStats({
        totalParking: 0,
        totalBookings: 0,
        totalUsers: 0,
        revenue: 0,
        activeBookings: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const statusClasses = {
      active: 'badge-success',
      completed: 'badge-info',
      cancelled: 'badge-danger'
    }
    return statusClasses[status] || 'badge-info'
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h2>Dashboard Overview</h2>
        <p>Welcome to Smart Parking Admin Panel</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon parking">
            <i className="fas fa-parking"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.totalParking}</h3>
            <p>Total Parking Locations</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bookings">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.totalBookings}</h3>
            <p>Total Bookings</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">
            <i className="fas fa-car-on-street"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.activeBookings}</h3>
            <p>Active Bookings</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon users">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.totalUsers}</h3>
            <p>Total Users</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon revenue">
            <i className="fas fa-wallet"></i>
          </div>
          <div className="stat-info">
            <h3>PKR {stats.revenue.toLocaleString()}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
      </div>

      <div className="recent-section">
        <h3>Recent Bookings</h3>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : recentBookings.length > 0 ? (
          <table className="bookings-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Parking</th>
                <th>Date</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((booking) => (
                <tr key={booking.booking_id || booking._id || booking.id}>
                  <td>#{booking.booking_id || 'N/A'}</td>
                  <td>{booking.user_name || booking.userName || 'N/A'}</td>
                  <td>{booking.parking_name || booking.parkingName || 'N/A'}</td>
                  <td>{booking.booking_time ? new Date(booking.booking_time).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(booking.status)}`}>
                      {booking.status || 'unknown'}
                    </span>
                  </td>
                  <td>PKR {booking.total_cost || booking.totalPrice || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <i className="fas fa-inbox"></i>
            <p>No bookings yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminDashboard