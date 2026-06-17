import { createContext, useContext, useState, type ReactNode } from 'react'

const ADMIN_PIN = '1008'

interface AdminContextType {
  isAdmin: boolean
  login: (pin: string) => boolean
  logout: () => void
}

const AdminContext = createContext<AdminContextType | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)

  function login(pin: string): boolean {
    if (pin === ADMIN_PIN) {
      setIsAdmin(true)
      return true
    }
    return false
  }

  function logout() {
    setIsAdmin(false)
  }

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdminCtx() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdminCtx must be inside AdminProvider')
  return ctx
}
