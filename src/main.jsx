import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import WakeGate from './components/WakeGate.jsx'
import Snow from './components/Snow.jsx'
import { THEME } from './shop.js'
import './styles.css'

document.documentElement.classList.add(`theme-${THEME}`)

createRoot(document.getElementById('root')).render(
  <>
    {THEME === 'christmas' && <Snow />}
    <WakeGate>
      <App />
    </WakeGate>
  </>
)
