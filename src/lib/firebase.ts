// Firebase initialization is isolated here. UI components never touch the SDK
// directly — they go through the auth service (src/services/auth.ts) instead.
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { env } from '@/config/env'

let app: FirebaseApp | null = null
let authInstance: Auth | null = null

export function getFirebaseAuth(): Auth | null {
  if (!env.isFirebaseConfigured) return null
  if (!authInstance) {
    app = getApps().length ? getApps()[0] : initializeApp(env.firebase)
    authInstance = getAuth(app)
    authInstance.useDeviceLanguage()
  }
  return authInstance
}

export function googleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}
