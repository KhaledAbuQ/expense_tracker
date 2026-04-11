import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import Income from './pages/Income'
import Transfers from './pages/Transfers'
import Savings from './pages/Savings'
import Categories from './pages/Categories'
import AuthPage from './pages/Auth'
import MembersPage from './pages/Members'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="income" element={<Income />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="transfers" element={<Transfers />} />
        <Route path="savings" element={<Savings />} />
        <Route path="categories" element={<Categories />} />
        <Route path="members" element={<MembersPage />} />
      </Route>
    </Routes>
  )
}

export default App
