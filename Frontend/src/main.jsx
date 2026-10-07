import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'aos/dist/aos.css'
import AOS from 'aos'

AOS.init({
  duration: 800,
  once: true,
  offset: 50,
  easing: 'ease-out-cubic'
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)





