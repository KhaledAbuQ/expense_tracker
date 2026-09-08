import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import NativeApp from './App'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NativeApp />
        <Toaster
          position="top-center"
          toastOptions={{
            className: '!bg-white !text-gray-900 dark:!bg-gray-800 dark:!text-gray-100 dark:!border dark:!border-gray-700 shadow-lg',
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
