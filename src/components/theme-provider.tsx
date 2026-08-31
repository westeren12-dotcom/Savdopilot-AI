import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

const ThemeCtx = createContext<{
  theme: Theme
  toggle: () => void
}>({ theme: 'light', toggle: () => undefined })

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  storageKey = 'savdopilot-theme'
}: { 
  children: ReactNode
  defaultTheme?: 'light' | 'dark' | 'system'
  storageKey?: string
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored) return stored
    return defaultTheme === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(storageKey, theme)
  }, [theme, storageKey])

  return (
    <ThemeCtx.Provider
      value={{
        theme,
        toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      }}
    >
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeCtx)
}
