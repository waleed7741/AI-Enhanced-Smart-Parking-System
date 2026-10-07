import { useState, useEffect } from 'react'
import './AdminUsers.css'
import ConfirmModal from '../components/ConfirmModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AdminUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, userId: null })

  useEffect(() => {
    fetchUsers()
    // Poll every 5 seconds for robust real-time updates
    const interval = setInterval(fetchUsers, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/users`)
      const data = await response.json()
      setUsers(Array.isArray(data) ? data : data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const toggleUserStatus = async (id, currentStatus) => {
    try {
      await fetch(`${API_URL}/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !currentStatus })
      })
      fetchUsers()
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const handleDeleteClick = (id) => {
    setConfirmModal({ isOpen: true, userId: id })
  }

  const handleDeleteConfirm = async () => {
    const id = confirmModal.userId
    setConfirmModal({ isOpen: false, userId: null })
    try {
      await fetch(`${API_URL}/api/users/${id}`, { method: 'DELETE' })
      fetchUsers()
    } catch (error) {
      console.error('Error deleting user:', error)
    }
  }

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  )

  return (
    <div className="admin-users">
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p>Manage registered users and their activity</p>
        </div>
      </div>

      <div className="search-bar">
        <i className="fas fa-search"></i>
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : filteredUsers.length > 0 ? (
        <div className="users-grid">
          {filteredUsers.map((user) => (
            <div key={user.user_id} className="user-card">
              <div className="user-avatar">
                <i className="fas fa-user"></i>
              </div>
              <div className="user-info">
                <h3>{user.name || 'Unknown User'}</h3>
                <p className="user-email">
                  <i className="fas fa-envelope"></i>
                  {user.email || 'No email'}
                </p>
                <p className="user-phone">
                  <i className="fas fa-phone"></i>
                  {user.phone || 'No phone'}
                </p>
                <p className="user-joined">
                  <i className="fas fa-calendar"></i>
                  Joined: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="user-actions">
                <button
                  className={`status-btn ${user.blocked ? 'blocked' : 'active'}`}
                  onClick={() => toggleUserStatus(user.user_id, user.blocked)}
                >
                  <i className={`fas ${user.blocked ? 'fa-check-circle' : 'fa-ban'}`}></i>
                  {user.blocked ? 'Unblock' : 'Block'}
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteClick(user.user_id)}
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-users-slash"></i>
          <p>No users found</p>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, userId: null })}
        confirmText="Delete"
        type="danger"
      />
    </div>
  )
}

export default AdminUsers