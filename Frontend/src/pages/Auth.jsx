import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Auth.css'
import { auth } from '../firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  getAdditionalUserInfo
} from 'firebase/auth'
import Toast from '../components/Toast'
import emailjs from 'emailjs-com'

const Auth = () => {
  const location = useLocation()
  const [isLogin, setIsLogin] = useState(location.pathname !== '/register')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setIsLogin(location.pathname !== '/register')
    setError('') // Clear error when swapping route modes
    setShowPassword(false) // Reset password toggle visibility
    
    // Check for registration success message passed in navigation state
    if (location.state?.message) {
      setSuccessMessage(location.state.message)
      // Clear history state so refresh doesn't keep showing the alert
      window.history.replaceState({}, document.title)
    } else {
      setSuccessMessage('')
    }
  }, [location])

  const sendTokenToBackend = async (user) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000'
    const token = await user.getIdToken(true)
    
    const response = await fetch(`${apiBase}/api/firebase_auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ token })
    })
    
    const data = await response.json()
    if (response.ok && data.success) {
      localStorage.setItem('isLoggedIn', 'true')
      localStorage.setItem('userToken', data.token)
      localStorage.setItem('userEmail', data.user.email)
      localStorage.setItem('userName', data.user.name)
      return data
    } else {
      throw new Error(data.error || 'Backend verification failed')
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)

      // Use Firebase's native getAdditionalUserInfo — this is set by Firebase
      // at the moment of account creation, so it's immune to MongoDB state.
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser

      // Fire welcome email BEFORE hitting the backend so MongoDB conflicts
      // can never block or suppress the registration email.
      if (isNewUser) {
        try {
          const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_1zmcy7n';
          const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
          const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

          if (publicKey && templateId && serviceId) {
            emailjs.init(publicKey);
            console.log('[EmailJS] New Google user detected — sending welcome email to:', result.user.email);
            await emailjs.send(
              serviceId,
              templateId,
              {
                user_name: result.user.displayName || result.user.email.split('@')[0],
                email: result.user.email
              }
            );
            console.log('[EmailJS] Welcome email sent successfully.');
          } else {
            console.warn('[EmailJS] Missing env variables — welcome email skipped.');
          }
        } catch (emailjsErr) {
          console.error('[EmailJS] Welcome email failed:', emailjsErr);
        }
      } else {
        console.log('[GoogleLogin] Returning user — skipping welcome email.');
      }

      // Now sync user record with the backend
      await sendTokenToBackend(result.user)

      navigate('/map')
    } catch (err) {
      console.error('Google Auth Error:', err)
      setError(err.message || 'Google Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      if (isLogin) {
        // Firebase Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password)
        const user = userCredential.user
        
        // Post Firebase token to Flask backend
        await sendTokenToBackend(user)
        navigate('/map')
      } else {
        // Firebase Register
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        const user = userCredential.user
        
        if (name) {
          await updateProfile(user, { displayName: name })
        }

        // Trigger EmailJS welcome email send
        try {
          const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_1zmcy7n';
          const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
          const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

          if (publicKey && templateId && serviceId) {
            emailjs.init(publicKey);
            console.log('--- STARTING FRONTEND EMAIL SEND (EmailJS) ---');
            const emailjsResponse = await emailjs.send(
              serviceId,
              templateId,
              {
                user_name: name || email.split('@')[0],
                email: email
              }
            );
            console.log('--- EMAILJS SEND SUCCESS ---', emailjsResponse);
            setToast({
              show: true,
              message: 'Welcome email sent successfully via EmailJS!',
              type: 'success'
            });
          } else {
            console.warn('EmailJS credentials not fully configured in .env. Skipping frontend email.');
          }
        } catch (emailjsErr) {
          console.error('--- EMAILJS SEND FAILED ---', emailjsErr);
          setToast({
            show: true,
            message: `Failed to send welcome email: ${emailjsErr.text || emailjsErr.message || emailjsErr}`,
            type: 'error'
          });
        }
        
        setToast({
          show: true,
          message: 'Account created successfully! Welcome to Smart Parking.',
          type: 'success'
        })
        
        // Post Firebase token to Flask backend
        await sendTokenToBackend(user)
        navigate('/map')
      }
    } catch (err) {
      console.error('Authentication error:', err)
      // Custom clean error message mapping for Firebase
      let msg = err.message
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password'
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'User with this email already exists'
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters'
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    const newMode = !isLogin
    setIsLogin(newMode)
    setError('')
    setShowPassword(false) // Reset password toggle visibility
    navigate(newMode ? '/login' : '/register')
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>{isLogin ? 'Login to Book' : 'Create Account'}</h1>
        <p>{isLogin ? 'Please enter your credentials to continue' : 'Join us to start booking parking slots'}</p>
        
        {error && (
          <div className="auth-error-banner">
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}

        {successMessage && (
          <div className="auth-success-banner" style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#10b981',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)',
            animation: 'authFadeIn 0.2s ease-in-out'
          }}>
            <i className="fas fa-check-circle"></i> {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required 
              />
            </div>
           )}
           <div className="form-group">
             <label>Email Address</label>
             <input 
               type="email" 
               placeholder="name@example.com" 
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               disabled={loading}
               required 
             />
           </div>
           <div className="form-group">
             <label>Password</label>
             <div style={{ position: 'relative' }}>
               <input 
                 type={showPassword ? "text" : "password"} 
                 placeholder="••••••••" 
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 disabled={loading}
                 required 
                 style={{ paddingRight: '45px' }}
               />
              <span 
                onClick={() => setShowPassword(!showPassword)}
                style={{ 
                  position: 'absolute', 
                  right: '16px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  cursor: 'pointer', 
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s',
                  zIndex: 10
                }}
              >
                <i 
                  className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} 
                  style={{ position: 'static', transform: 'none', color: 'inherit', fontSize: '15px' }}
                ></i>
              </span>
            </div>
          </div>
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin"></i> Processing...</> : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>

        <div className="social-login-separator">
          <span>or continue with</span>
        </div>

        <button type="button" className="btn-google" onClick={handleGoogleLogin} disabled={loading}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24c0-1.63-.15-3.2-.43-4.75H24v9h12.75c-.55 2.87-2.17 5.3-4.61 6.94l7.19 5.57C43.5 35.8 46.5 30.43 46.5 24z"/>
            <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.19-5.57c-2.21 1.48-5.03 2.38-8.7 2.38-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? 'Processing...' : 'Sign in with Google'}
        </button>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span className="link" onClick={toggleMode}>
              {isLogin ? 'Register' : 'Login'}
            </span>
          </p>
        </div>
      </div>
      <Toast 
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </div>
  )
}

export default Auth
