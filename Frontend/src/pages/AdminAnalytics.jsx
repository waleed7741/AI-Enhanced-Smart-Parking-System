import { useState, useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import './AdminAnalytics.css'

Chart.register(...registerables)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AdminAnalytics = () => {
  const [stats, setStats] = useState({
    bookingsPerParking: [],
    dailyBookings: [],
    slotUtilization: { available: 0, occupied: 0 }
  })
  const [loading, setLoading] = useState(true)

  const barChartRef = useRef(null)
  const lineChartRef = useRef(null)
  const doughnutChartRef = useRef(null)
  const chartInstances = useRef({})

  useEffect(() => {
    fetchAnalytics()
    return () => {
      Object.values(chartInstances.current).forEach(chart => chart?.destroy())
    }
  }, [])

  const fetchAnalytics = async () => {
    try {
      const [parkingRes, bookingsRes] = await Promise.all([
        fetch(`${API_URL}/api/parking`),
        fetch(`${API_URL}/api/bookings`)
      ])

      const parkingData = await parkingRes.json()
      const bookingsData = await bookingsRes.json()

      const parking = Array.isArray(parkingData) ? parkingData : parkingData.parking || []
      const bookings = Array.isArray(bookingsData) ? bookingsData : bookingsData.bookings || []

      // Calculate bookings per parking
      const bookingsPerParking = parking.map(p => ({
        name: p.name,
        count: bookings.filter(b => b.parking_id === p.id || b.parkingName === p.name || b.parking_name === p.name).length
      }))

      // Calculate daily bookings (last 7 days)
      const dailyBookings = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const count = bookings.filter(b => {
          const bDate = b.booking_time || b.bookingTime || b.date
          return bDate && bDate.split('T')[0] === dateStr
        }).length
        dailyBookings.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          count
        })
      }

      // Calculate slot utilization
      const totalSlots = parking.reduce((acc, p) => acc + (p.capacity || 0), 0)
      const availableSlots = parking.reduce((acc, p) => acc + (p.available || 0), 0)
      const occupiedSlots = totalSlots - availableSlots

      setStats({
        bookingsPerParking,
        dailyBookings,
        slotUtilization: { available: availableSlots, occupied: occupiedSlots }
      })
    } catch (error) {
      console.error('Error fetching analytics:', error)
      setStats({
        bookingsPerParking: [],
        dailyBookings: [],
        slotUtilization: { available: 0, occupied: 0 }
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!loading) {
      renderCharts()
    }
  }, [loading])

  const renderCharts = () => {
    // Destroy existing charts
    Object.values(chartInstances.current).forEach(chart => chart?.destroy())
    chartInstances.current = {}

    // Bar Chart - Bookings per Parking
    if (barChartRef.current && stats.bookingsPerParking.length > 0) {
      chartInstances.current.bar = new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: stats.bookingsPerParking.map(p => p.name),
          datasets: [{
            label: 'Bookings',
            data: stats.bookingsPerParking.map(p => p.count),
            backgroundColor: 'rgba(56, 189, 248, 0.7)',
            borderColor: '#38bdf8',
            borderWidth: 1,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          }
        }
      })
    }

    // Line Chart - Daily Bookings
    if (lineChartRef.current && stats.dailyBookings.length > 0) {
      chartInstances.current.line = new Chart(lineChartRef.current, {
        type: 'line',
        data: {
          labels: stats.dailyBookings.map(d => d.date),
          datasets: [{
            label: 'Bookings',
            data: stats.dailyBookings.map(d => d.count),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
          }
        }
      })
    }

    // Doughnut Chart - Slot Utilization
    if (doughnutChartRef.current) {
      chartInstances.current.doughnut = new Chart(doughnutChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Available', 'Occupied'],
          datasets: [{
            data: [stats.slotUtilization.available, stats.slotUtilization.occupied],
            backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(239, 68, 68, 0.8)'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', padding: 20 }
            }
          }
        }
      })
    }
  }

  return (
    <div className="admin-analytics">
      <div className="page-header">
        <h2>Analytics & Reports</h2>
        <p>View parking trends and statistics</p>
      </div>

      {loading ? (
        <div className="loading">Loading charts...</div>
      ) : (
        <div className="charts-grid">
          <div className="chart-card">
            <h3>Bookings by Parking Location</h3>
            <div className="chart-container">
              <canvas ref={barChartRef}></canvas>
            </div>
          </div>

          <div className="chart-card">
            <h3>Daily Bookings (Last 7 Days)</h3>
            <div className="chart-container">
              <canvas ref={lineChartRef}></canvas>
            </div>
          </div>

          <div className="chart-card doughnut-card">
            <h3>Slot Utilization</h3>
            <div className="chart-container doughnut-container">
              <canvas ref={doughnutChartRef}></canvas>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAnalytics