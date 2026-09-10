// Reusable authentication functions. UI components call these — never the Firebase
// SDK directly. Falls back to the existing demo auth (app-store) when Firebase is
// not configured (missing env vars), so Demo Mode and the local demo accounts keep
// working unchanged.
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth, googleProvider } from '@/lib/firebase'
import { stashPendingProduct, type ProductType } from '@/lib/product-context'
import { actions, getState, subscribe } from '@/store/app-store'

type DemoResult = { uid: string; email: string | null; displayName: string | null }

function demoGoogleSignIn(): DemoResult {
  actions.loginGoogle()
  const profile = { uid: 'demo-google-user', email: 'demo@savdopilot.uz', displayName: 'Demo Google User' }
  return profile
}

function demoEmailSignIn(email: string, displayName?: string): DemoResult {
  // Demo mode: accept any credentials by delegating to the local store; fall back to
  // registering a throwaway profile when the account does not exist yet.
  try {
    actions.login(email, 'demo1234')
    return { uid: 'demo-email-user', email, displayName: displayName ?? null }
  } catch {
    actions.register({
      fullName: displayName || email.split('@')[0],
      email,
      password: 'demo1234',
      businessName: 'Demo Business',
      businessType: 'other',
    })
    return { uid: 'demo-email-user', email, displayName: displayName ?? null }
  }
}

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Email format noto‘g‘ri.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email yoki parol noto‘g‘ri.'
    case 'auth/email-already-in-use':
      return 'Bu email allaqachon ro‘yxatdan o‘tgan.'
    case 'auth/weak-password':
      return 'Parol juda oddiy — kamida 6 belgi bo‘lsin.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google oynasi yopildi.'
    case 'auth/popup-blocked':
      return 'Brauzer popup’ni blokladi — ruxsat bering.'
    case 'auth/popup-request-pending':
      return 'Boshqa login oynasi ochiq — yopib ko‘ring.'
    case 'auth/network-request-failed':
      return 'Tarmoq xatosi. Internetni tekshiring.'
    case 'auth/too-many-requests':
      return 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.'
    default:
      return 'Xatolik yuz berdi. Qayta urinib ko‘ring.'
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export type AuthUser = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  provider: 'google' | 'password' | 'demo'
}

function toAuthUser(u: User): AuthUser {
  const providerId = u.providerData[0]?.providerId ?? ''
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
    provider: providerId.includes('google') ? 'google' : providerId.includes('password') ? 'password' : 'demo',
  }
}

function toAuthUserFromDemo(r: DemoResult): AuthUser {
  return { ...r, photoURL: null, provider: 'demo' as const }
}

// -------- Public API (same signatures for Firebase & demo paths) --------

export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const auth = getFirebaseAuth()
  if (!auth) {
    return toAuthUserFromDemo(demoEmailSignIn(email, fullName))
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (fullName) await updateProfile(cred.user, { displayName: fullName })
    return toAuthUser(cred.user)
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    throw new AuthError(mapAuthError(code))
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  const auth = getFirebaseAuth()
  if (!auth) {
    return toAuthUserFromDemo(demoEmailSignIn(email))
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return toAuthUser(cred.user)
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    throw new AuthError(mapAuthError(code))
  }
}

export async function signInWithGoogle(product: ProductType | null): Promise<AuthUser> {
  stashPending(product)
  const auth = getFirebaseAuth()
  if (!auth) {
    return toAuthUserFromDemo(demoGoogleSignIn())
  }
  try {
    const cred = await signInWithPopup(auth, googleProvider())
    return toAuthUser(cred.user)
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    if (code === 'auth/unauthorized-domain') {
      throw new AuthError('Bu domen Firebase Console’dagi Authorized domains ro‘yxatiga qo‘shilmagan.')
    }
    throw new AuthError(mapAuthError(code))
  }
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth()
  if (auth) await fbSignOut(auth)
  actions.logout()
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getFirebaseAuth()
  if (!auth) {
    actions.resetPassword(email) // demo: just validate the email exists locally
    return
  }
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (err) {
    const code = (err as { code?: string }).code ?? ''
    throw new AuthError(mapAuthError(code))
  }
}

export function onAuthStateChangedListener(cb: (user: AuthUser | null) => void): () => void {
  const auth = getFirebaseAuth()
  if (!auth) {
    // Demo mode: bridge the local store's session into the same AuthUser shape.
    const emit = () => {
      const s = getState()
      const p = s.profiles.find((x) => x.id === s.sessionUserId)
      cb(
        p
          ? { uid: p.id, email: p.email, displayName: p.fullName, photoURL: null, provider: 'demo' }
          : null,
      )
    }
    emit()
    return subscribe(emit)
  }
  return onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null))
}

function stashPending(product: ProductType | null) {
  if (product) stashPendingProduct(product)
}
