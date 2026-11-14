import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import WakeGate from './components/WakeGate.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <WakeGate>
    <App />
  </WakeGate>
)
