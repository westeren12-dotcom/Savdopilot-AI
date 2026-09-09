function readFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback
  return value === 'true' || value === '1'
}

export const env = {
  useDemoMode: readFlag(import.meta.env.VITE_USE_DEMO_MODE, true),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  appUrl: import.meta.env.VITE_APP_URL ?? 'http://localhost:5173',
  appName: import.meta.env.VITE_APP_NAME ?? 'AventryX AI',
} as const

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey)
}
