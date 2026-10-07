import { useState, useEffect } from 'react'
import './AdminMessages.css'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AdminMessages = () => {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [toast, setToast] = useState({ message: '', type: 'info' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, msgId: null })

  useEffect(() => {
    fetchMessages()
    // Poll every 5 seconds for real-time contact updates
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/contact`)
      const data = await response.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching contact messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (id) => {
    setConfirmModal({ isOpen: true, msgId: id })
  }

  const handleDeleteConfirm = async () => {
    const id = confirmModal.msgId
    setConfirmModal({ isOpen: false, msgId: null })
    try {
      const response = await fetch(`${API_URL}/api/contact/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (response.ok && data.success) {
        fetchMessages()
        setToast({ message: 'Message deleted successfully', type: 'success' })
      } else {
        setToast({ message: data.error || 'Failed to delete message', type: 'error' })
      }
    } catch (error) {
      console.error('Error deleting message:', error)
    }
  }

  const filteredMessages = messages.filter(msg =>
    msg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.message?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="admin-messages" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '350px', color: '#38bdf8' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2.5rem', marginBottom: '16px' }}></i>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading messages & inquiries...</p>
      </div>
    )
  }

  return (
    <div className="admin-messages">
      <div className="page-header">
        <div>
          <h2>User Messages & Inquiries</h2>
          <p>Read and manage contact requests submitted by users</p>
        </div>
      </div>

      <div className="relative w-full max-w-md mb-6">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <i className="fas fa-search text-gray-400 w-5 h-5"></i>
        </div>
        <input
          type="text"
          className="block w-full p-3 pl-10 text-sm text-white bg-[#1e293b] border border-gray-700 rounded-lg focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 outline-none"
          placeholder="Search messages by name, email, subject, keyword..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredMessages.length > 0 ? (
        <div className="messages-list">
          {filteredMessages.map((msg) => (
            <div key={msg._id} className="message-card">
              <div className="msg-header">
                <div className="msg-user-details">
                  <div className="msg-avatar">
                    <i className="fas fa-envelope-open"></i>
                  </div>
                  <div>
                    <h3>{msg.name}</h3>
                    <a href={`mailto:${msg.email}`} className="msg-email">
                      <i className="fas fa-envelope"></i> {msg.email}
                    </a>
                  </div>
                </div>
                <div className="msg-meta">
                  <span className="msg-date">
                    <i className="fas fa-clock"></i> {new Date(msg.created_at).toLocaleString()}
                  </span>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteClick(msg._id)}
                    title="Delete message"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>

              <div className="msg-body">
                <div className="msg-subject">
                  <strong>Subject:</strong> {msg.subject}
                </div>
                <div className="msg-text">
                  {msg.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <i className="fas fa-envelope-circle-check"></i>
          <p>No messages or inquiries found</p>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Message"
        message="Are you sure you want to delete this contact message? This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmModal({ isOpen: false, msgId: null })}
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

export default AdminMessages
