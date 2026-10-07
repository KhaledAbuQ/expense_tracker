import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '../context/AuthContext'
import { ThemeProvider } from '../context/ThemeContext'
import NativeApp from './App'
import HapticSurface from '../components/HapticSurface'
import '../index.css'

document.documentElement.classList.add('pocket-native-document')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <HapticSurface>
        <NativeApp />
        <Toaster
          position="top-center"
          toastOptions={{
            className: '!bg-white !text-gray-900 dark:!bg-gray-800 dark:!text-gray-100 dark:!border dark:!border-gray-700 shadow-lg',
          }}
        />
        </HapticSurface>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
