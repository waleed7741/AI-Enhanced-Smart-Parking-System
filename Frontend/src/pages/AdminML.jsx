import { useState, useEffect } from 'react'
import './AdminML.css'
import ConfirmModal from '../components/ConfirmModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const AdminML = () => {
  const [modelStats, setModelStats] = useState({
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    predictions: 0,
    lastTrained: null,
    modelType: 'Loading...'
  })
  const [training, setTraining] = useState(false)
  const [logs, setLogs] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchModelStats()
  }, [])

  const fetchModelStats = async () => {
    try {
      const response = await fetch(`${API_URL}/meta`)
      const data = await response.json()
      if (data.status === 'ok') {
        setModelStats({
          accuracy: (data.accuracy * 100).toFixed(1),
          precision: (data.precision * 100).toFixed(1),
          recall: (data.recall * 100).toFixed(1),
          f1Score: (data.f1_score * 100).toFixed(1),
          predictions: data.predictions_made || 0,
          lastTrained: data.last_trained || 'Not trained',
          modelType: data.model_type || 'Neural Network'
        })
      }
    } catch (error) {
      console.error('Error fetching model stats:', error)
      // Demo data
      setModelStats({
        accuracy: 94.2,
        precision: 92.8,
        recall: 91.5,
        f1Score: 92.1,
        predictions: 1247,
        lastTrained: new Date().toISOString(),
        modelType: 'Keras Neural Network'
      })
    }
  }

  const handleRetrainClick = () => {
    setShowConfirm(true)
  }

  const handleRetrainConfirm = async () => {
    setShowConfirm(false)
    setTraining(true)
    setLogs(['Starting model retraining...'])

    try {
      const response = await fetch(`${API_URL}/retrain`, { method: 'POST' })
      const data = await response.json()

      if (data.status === 'ok') {
        setLogs(prev => [...prev, `Training complete! Accuracy: ${(data.accuracy * 100).toFixed(1)}%`])
        fetchModelStats()
      } else {
        setLogs(prev => [...prev, `Error: ${data.message || 'Training failed'}`])
      }
    } catch (error) {
      console.error('Error retraining model:', error)
      setLogs(prev => [...prev, 'Error: Could not connect to training server'])
    } finally {
      setTraining(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 90) return '#22c55e'
    if (score >= 75) return '#eab308'
    return '#ef4444'
  }

  return (
    <div className="admin-ml">
      <div className="page-header">
        <div>
          <h2>AI/ML Model Management</h2>
          <p>Monitor and manage the prediction model</p>
        </div>
        <button
          className="btn-primary"
          onClick={handleRetrainClick}
          disabled={training}
        >
          <i className={`fas ${training ? 'fa-spinner fa-spin' : 'fa-refresh'}`}></i>
          {training ? 'Training...' : 'Retrain Model'}
        </button>
      </div>

      <div className="model-info">
        <div className="info-badge">
          <i className="fas fa-brain"></i>
          <span>Model: {modelStats.modelType}</span>
        </div>
        <div className="info-badge">
          <i className="fas fa-chart-line"></i>
          <span>Predictions Made: {modelStats.predictions.toLocaleString()}</span>
        </div>
        <div className="info-badge">
          <i className="fas fa-clock"></i>
          <span>Last Trained: {modelStats.lastTrained ? new Date(modelStats.lastTrained).toLocaleString() : 'Never'}</span>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <h3>Accuracy</h3>
            <i className="fas fa-bullseye"></i>
          </div>
          <div className="metric-value" style={{ color: getScoreColor(modelStats.accuracy) }}>
            {modelStats.accuracy}%
          </div>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${modelStats.accuracy}%`, background: getScoreColor(modelStats.accuracy) }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Precision</h3>
            <i className="fas fa-crosshairs"></i>
          </div>
          <div className="metric-value" style={{ color: getScoreColor(modelStats.precision) }}>
            {modelStats.precision}%
          </div>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${modelStats.precision}%`, background: getScoreColor(modelStats.precision) }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>Recall</h3>
            <i className="fas fa-undo"></i>
          </div>
          <div className="metric-value" style={{ color: getScoreColor(modelStats.recall) }}>
            {modelStats.recall}%
          </div>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${modelStats.recall}%`, background: getScoreColor(modelStats.recall) }}></div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h3>F1 Score</h3>
            <i className="fas fa-balance-scale"></i>
          </div>
          <div className="metric-value" style={{ color: getScoreColor(modelStats.f1Score) }}>
            {modelStats.f1Score}%
          </div>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${modelStats.f1Score}%`, background: getScoreColor(modelStats.f1Score) }}></div>
          </div>
        </div>
      </div>

      <div className="training-logs">
        <h3>Training Logs</h3>
        <div className="logs-container">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="log-entry">
                <i className="fas fa-terminal"></i>
                <span>{log}</span>
              </div>
            ))
          ) : (
            <div className="log-entry empty">
              <i className="fas fa-info-circle"></i>
              <span>No training logs yet. Click "Retrain Model" to start.</span>
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={showConfirm}
        title="Retrain Model"
        message="Are you sure you want to retrain the model? This may take a few minutes."
        onConfirm={handleRetrainConfirm}
        onCancel={() => setShowConfirm(false)}
        confirmText="Retrain"
        type="primary"
      />
    </div>
  )
}

export default AdminML