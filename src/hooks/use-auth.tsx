// Auth state hooks. One global Firebase listener (or demo-store bridge) started
// once at App level via <AuthInit />; consumers read the context.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChangedListener, signOut, type AuthUser } from '@/services/auth'
import { readSelectedProduct, writeSelectedProduct, type ProductType } from '@/lib/product-context'

type AuthCtx = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  selectedProduct: ProductType | null
  setSelectedProduct: (p: ProductType | null) => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthInit({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProductState] = useState<ProductType | null>(() =>
    readSelectedProduct(),
  )

  useEffect(() => {
    const unsub = onAuthStateChangedListener((u) => {
      setUser(u)
      setLoading(false)
    })
    return () => {
      // The demo bridge returns a Promise-like before subscribing; both paths are sync enough.
      if (typeof unsub === 'function') unsub()
    }
  }, [])

  const setSelectedProduct = (p: ProductType | null) => {
    setSelectedProductState(p)
    writeSelectedProduct(p)
  }

  const value = useMemo(
    () => ({ user, loading, signOut, selectedProduct, setSelectedProduct }),
    [user, loading, selectedProduct],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used inside <AuthInit>')
  return ctx
}
