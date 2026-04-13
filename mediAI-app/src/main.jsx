import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'

// Import your publishable key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const root = createRoot(document.getElementById('root'))

if (!PUBLISHABLE_KEY) {
  root.render(
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#050b14', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: 'rgba(30,41,59,0.5)', borderRadius: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)', maxWidth: '28rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f87171', marginBottom: '1rem' }}>Clerk Key Missing ⚠️</h2>
        <p style={{ color: '#cbd5e1' }}>
          Please add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to your <code>.env</code> file.
        </p>
      </div>
    </div>
  )
} else {
  root.render(
    <StrictMode>
      <ClerkProvider 
        publishableKey={PUBLISHABLE_KEY} 
        afterSignOutUrl="/"
        appearance={{
          baseTheme: dark
        }}
      >
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
}
