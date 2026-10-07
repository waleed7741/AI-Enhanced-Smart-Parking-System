import { useEffect, useState } from 'react'
import { useNavigate, Outlet } from 'react-router-dom'

/**
 * AdminRoute — wraps all /admin/* routes.
 *
 * Rules:
 *  1. Not logged in → redirect to /login
 *  2. VITE_ADMIN_EMAIL is set AND the logged-in email does not match → show Access Denied
 *  3. Otherwise → render children (AdminLayout + nested pages) via <Outlet />
 *
 * To configure the admin email, add this line to your .env file:
 *   VITE_ADMIN_EMAIL=your.admin@email.com
 * If VITE_ADMIN_EMAIL is left blank, any logged-in user can access admin (dev/demo mode).
 */
const AdminRoute = () => {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // 'checking' | 'authorized' | 'denied'

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
    const userEmail = (localStorage.getItem('userEmail') || '').trim().toLowerCase()
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase()

    if (!isLoggedIn) {
      navigate('/login', { replace: true })
      return
    }

    // If an admin email is configured, enforce it
    if (adminEmail && userEmail !== adminEmail) {
      setStatus('denied')
      return
    }

    setStatus('authorized')
  }, [navigate])

  // ── Loading state ─────────────────────────────────────────────────────────
  if (status === 'checking') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#0f172a',
        color: '#38bdf8',
        fontSize: '16px',
        gap: '10px'
      }}>
        <i className="fas fa-spinner fa-spin"></i> Verifying admin access...
      </div>
    )
  }

  // ── Access Denied state ───────────────────────────────────────────────────
  if (status === 'denied') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#0f172a',
        color: '#f1f5f9',
        gap: '16px',
        textAlign: 'center',
        padding: '24px'
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.15)',
          border: '2px solid rgba(239,68,68,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          color: '#f87171'
        }}>
          <i className="fas fa-shield-halved"></i>
        </div>
        <h2 style={{ margin: 0, fontSize: '24px', color: '#f87171' }}>Access Denied</h2>
        <p style={{ color: '#94a3b8', maxWidth: '380px', lineHeight: '1.6', margin: 0 }}>
          You don&apos;t have permission to access the admin panel.
          Please contact your system administrator.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '8px',
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <i className="fas fa-home" style={{ marginRight: '8px' }}></i>Go to Home
        </button>
      </div>
    )
  }

  // ── Authorized — render nested admin routes ───────────────────────────────
  return <Outlet />
}

export default AdminRoute
