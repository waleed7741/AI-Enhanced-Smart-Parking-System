import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ show = true, message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (!show || !message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, message, duration, onClose]);

  if (!message) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'fa-circle-check';
      case 'error':
        return 'fa-circle-xmark';
      case 'warning':
        return 'fa-triangle-exclamation';
      case 'info':
      default:
        return 'fa-circle-info';
    }
  };

  const transitionStyles = {
    transition: 'opacity 0.5s ease, transform 0.5s ease',
    opacity: show ? 1 : 0,
    transform: show ? 'translateY(0)' : 'translateY(-20px)',
    pointerEvents: show ? 'auto' : 'none'
  };

  return (
    <div className="toast-notification-container">
      <div className={`toast-notification-item toast-${type}`} style={transitionStyles}>
        <div className="toast-icon">
          <i className={`fa-solid ${getIcon()}`}></i>
        </div>
        <div className="toast-content">
          <p className="toast-message">{message}</p>
        </div>
        <button className="toast-close-btn" onClick={onClose} aria-label="Close">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  );
};

export default Toast;
