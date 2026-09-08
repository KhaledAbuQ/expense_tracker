import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '../context/AuthContext'
import NativeApp from './App'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <NativeApp />
      <Toaster position="top-center" />
    </AuthProvider>
  </React.StrictMode>,
)
