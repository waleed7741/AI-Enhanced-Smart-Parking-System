import { useState, useEffect, useMemo, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import './Dashboard.css'

// Register all Chart.js components
Chart.register(...registerables)

const Dashboard = () => {
  const [parkingData, setParkingData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Chart canvas refs
  const barChartRef = useRef(null)
  const lineChartRef = useRef(null)
  const doughnutChartRef = useRef(null)
  const radarChartRef = useRef(null)
  const chartInstances = useRef({})

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${apiBase}/api/parking`)
        if (res.ok) {
          const data = await res.json()
          setParkingData(Array.isArray(data) ? data : [])
        } else {
          throw new Error(`Server returned status ${res.status}`)
        }
      } catch (err) {
        console.error('Error fetching live parking data for Dashboard:', err)
        setParkingData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCapacity = parkingData.reduce((sum, p) => sum + (p.capacity || 0), 0)
    const totalAvailable = parkingData.reduce((sum, p) => sum + (p.available || 0), 0)
    const totalOccupied = totalCapacity - totalAvailable
    const occupancyRate = totalCapacity > 0 ? ((totalOccupied / totalCapacity) * 100).toFixed(1) : 0

    const sectorData = parkingData.reduce((acc, parking) => {
      const key = parking.sector || 'Unknown'
      if (!acc[key]) acc[key] = { capacity: 0, available: 0 }
      acc[key].capacity += (parking.capacity || 0)
      acc[key].available += (parking.available || 0)
      return acc
    }, {})

    const sectors = Object.keys(sectorData)
    const sectorCapacities = sectors.map(s => sectorData[s].capacity)
    const sectorAvailabilities = sectors.map(s => sectorData[s].available)

    const statusCounts = parkingData.reduce((acc, parking) => {
      const status = parking.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    const hours = ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM']
    const hourlyUsage = [25, 45, 75, 95, 88, 92, 85, 65, 35]
    const peakHours = hourlyUsage.indexOf(Math.max(...hourlyUsage))

    return {
      totalCapacity,
      totalAvailable,
      occupancyRate,
      totalOccupied,
      sectorData,
      sectors,
      sectorCapacities,
      sectorAvailabilities,
      statusCounts,
      hours,
      hourlyUsage,
      peakHours
    }
  }, [parkingData])

  const { totalCapacity, totalAvailable, occupancyRate, totalOccupied, sectorData, sectors, sectorCapacities, sectorAvailabilities, statusCounts, hours, hourlyUsage, peakHours } = stats

  // Render charts when data is ready
  useEffect(() => {
    if (isLoading || sectors.length === 0) return

    // Destroy existing charts
    Object.keys(chartInstances.current).forEach(key => {
      if (chartInstances.current[key]) {
        chartInstances.current[key].destroy()
        chartInstances.current[key] = null
      }
    })

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 20, usePointStyle: true }
        }
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { ticks: { color: '#64748b' }, grid: { display: false } }
      }
    }

    // Bar Chart
    if (barChartRef.current) {
      chartInstances.current.bar = new Chart(barChartRef.current, {
        type: 'bar',
        data: {
          labels: sectors,
          datasets: [
            { label: 'Occupied', data: sectorCapacities.map((cap, i) => cap - sectorAvailabilities[i]), backgroundColor: 'rgba(56, 189, 248, 0.8)', borderRadius: 6 },
            { label: 'Available', data: sectorAvailabilities, backgroundColor: 'rgba(34, 197, 94, 0.8)', borderRadius: 6 }
          ]
        },
        options: chartOptions
      })
    }

    // Line Chart
    if (lineChartRef.current) {
      chartInstances.current.line = new Chart(lineChartRef.current, {
        type: 'line',
        data: {
          labels: hours,
          datasets: [{ label: 'Occupancy %', data: hourlyUsage, borderColor: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#a855f7', pointRadius: 5 }]
        },
        options: { ...chartOptions, scales: { ...chartOptions.scales, y: { ...chartOptions.scales.y, max: 100 } } }
      })
    }

    // Doughnut Chart
    if (doughnutChartRef.current) {
      const statusLabels = Object.keys(statusCounts).length > 0 ? Object.keys(statusCounts).map(s => s.charAt(0).toUpperCase() + s.slice(1)) : ['Available', 'Busy', 'Full']
      const statusValues = Object.values(statusCounts).length > 0 ? Object.values(statusCounts) : [3, 2, 1]

      chartInstances.current.doughnut = new Chart(doughnutChartRef.current, {
        type: 'doughnut',
        data: {
          labels: statusLabels,
          datasets: [{ data: statusValues, backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(251, 191, 36, 0.8)', 'rgba(239, 68, 68, 0.8)'], borderWidth: 2, hoverOffset: 12 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 16 } } } }
      })
    }

    // Radar Chart
    if (radarChartRef.current) {
      chartInstances.current.radar = new Chart(radarChartRef.current, {
        type: 'radar',
        data: {
          labels: ['Capacity', 'Availability', 'Revenue', 'Efficiency', 'Coverage'],
          datasets: [{ label: 'Performance', data: [40, 60, 75, 70, 65], backgroundColor: 'rgba(56, 189, 248, 0.2)', borderColor: '#38bdf8', borderWidth: 2, pointBackgroundColor: '#38bdf8' }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 100, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#94a3b8', font: { size: 11 } } } }, plugins: { legend: { display: false } } }
      })
    }

    // Cleanup on unmount
    return () => {
      Object.keys(chartInstances.current).forEach(key => {
        if (chartInstances.current[key]) {
          chartInstances.current[key].destroy()
          chartInstances.current[key] = null
        }
      })
    }
  }, [isLoading, sectors.length])

  const metrics = [
    { label: 'Total Locations', value: parkingData.length, icon: 'fa-location-dot', color: '#38bdf8' },
    { label: 'Total Capacity', value: totalCapacity.toLocaleString(), icon: 'fa-car', color: '#a855f7' },
    { label: 'Available', value: totalAvailable.toLocaleString(), icon: 'fa-circle-check', color: '#22c55e' },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: 'fa-gauge-high', color: occupancyRate > 80 ? '#ef4444' : '#f59e0b' },
    { label: 'Active Bookings', value: totalOccupied.toLocaleString(), icon: 'fa-ticket', color: '#06b6d4' },
    { label: 'Revenue Today', value: `PKR ${(totalOccupied * 60).toLocaleString()}`, icon: 'fa-wallet', color: '#eab308' }
  ]

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner"><i className="fas fa-spinner fa-spin"></i></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard-hero">
        <div className="hero-content">
          <div className="hero-text">
            <h1>Parking Analytics</h1>
            <p>Real-time insights for Smart Parking System</p>
          </div>
        </div>
        <div className="hero-bg-animation"></div>
      </div>

      <div className="dashboard-content">
        <div className="stats-section">
          <div className="stats-grid">
            {metrics.map((metric, index) => (
              <div key={index} className="stat-card" style={{ '--accent': metric.color }}>
                <div className="stat-icon"><i className={`fas ${metric.icon}`}></i></div>
                <div className="stat-content">
                  <span className="stat-label">{metric.label}</span>
                  <span className="stat-value">{metric.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="charts-section">
          <div className="charts-row">
            <div className="chart-card">
              <div className="chart-header">
                <h3><i className="fas fa-chart-bar"></i> Capacity Analysis</h3>
                <span className="chart-badge">Real-time</span>
              </div>
              <div className="chart-container">
                <canvas ref={barChartRef}></canvas>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <h3><i className="fas fa-chart-pie"></i> Status Distribution</h3>
              </div>
              <div className="chart-container">
                <canvas ref={doughnutChartRef}></canvas>
              </div>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card">
              <div className="chart-header">
                <h3><i className="fas fa-chart-line"></i> Hourly Usage Pattern</h3>
                <span className="peak-badge"><i className="fas fa-fire"></i> Peak at {hours[peakHours] || 'N/A'}</span>
              </div>
              <div className="chart-container">
                <canvas ref={lineChartRef}></canvas>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <h3><i className="fas fa-chart-radial"></i> Performance Metrics</h3>
              </div>
              <div className="chart-container">
                <canvas ref={radarChartRef}></canvas>
              </div>
            </div>
          </div>
        </div>

        <div className="table-section">
          <div className="section-header">
            <h3><i className="fas fa-table"></i> Sector Performance</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sector</th>
                  <th>Capacity</th>
                  <th>Available</th>
                  <th>Occupied</th>
                  <th>Occupancy %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sectors.map(sector => {
                  const capacity = sectorData[sector].capacity
                  const available = sectorData[sector].available
                  const occupied = capacity - available
                  const occupancy = capacity > 0 ? ((occupied / capacity) * 100).toFixed(0) : 0
                  const status = occupancy > 80 ? 'critical' : occupancy > 50 ? 'busy' : 'available'

                  return (
                    <tr key={sector}>
                      <td className="sector-name"><i className="fas fa-map-marker-alt"></i>{sector}</td>
                      <td>{capacity}</td>
                      <td className="available-cell">{available}</td>
                      <td>{occupied}</td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${occupancy}%`, background: status === 'critical' ? '#ef4444' : status === 'busy' ? '#f59e0b' : '#22c55e' }}></div>
                          </div>
                          <span>{occupancy}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${status}`}>
                          <i className={`fas ${status === 'critical' ? 'fa-circle-exclamation' : status === 'busy' ? 'fa-circle' : 'fa-circle-check'}`}></i>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard