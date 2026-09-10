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
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  },
  get isFirebaseConfigured(): boolean {
    const f = this.firebase
    const filled = (v: string) => Boolean(v) && !v.startsWith('your-')
    return Boolean(
      filled(f.apiKey) && filled(f.authDomain) && filled(f.projectId) && filled(f.appId),
    )
  },
} as const

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey)
}

export function isFirebaseConfigured(): boolean {
  return env.isFirebaseConfigured
}
