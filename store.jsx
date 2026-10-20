import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { backend } from './repository.js'
import { inspectPublicEnv } from './security.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const configIssues = useMemo(() => inspectPublicEnv(import.meta.env), [])

  useEffect(() => {
    setUser(backend.session().user)
    setReady(true)
  }, [])

  async function refresh() {
    const next = backend.session().user
    setUser(next)
    return next
  }

  const value = {
    user,
    ready,
    backend,
    configIssues,
    mode: backend.mode,
    async register(input) { return backend.register(input) },
    verifyEmail(input) { return backend.verifyEmail(input) },
    async login(input) {
      const result = await backend.login(input)
      if (result.ok) setUser(result.user)
      return result
    },
    logout() {
      backend.logout()
      setUser(null)
    },
    async enableMfa() { return backend.enableMfa() },
    async disableMfa(otp) {
      const result = await backend.disableMfa(otp)
      if (result.ok) await refresh()
      return result
    },
    updateProfile(patch) {
      const result = backend.updateProfile(patch)
      if (result.ok) setUser(result.user)
      return result
    },
    deleteAccount() {
      const result = backend.deleteAccount()
      if (result.ok) setUser(null)
      return result
    },
    developmentInbox(email) { return backend.developmentInbox(email) },
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
