// Auth pages. UI calls only the auth service — no Firebase SDK here.
// Product direction (?product=sales|invoices) is kept in product-context so it
// survives the whole auth round-trip (including Google popup).
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  resetPassword,
  AuthError,
  firebaseConfigMissing,
} from '@/services/auth'
import { actions } from '@/store/app-store'
import {
  PRODUCT_LABELS,
  parseProduct,
  stashPendingProduct,
  writeSelectedProduct,
  type ProductType,
} from '@/lib/product-context'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const pageCopy = {
  uz: {
    loginTitle: 'Kirish',
    loginGreeting: 'Hisobingizga kiring va ishni davom ettiring.',
    registerTitle: 'Ro‘yxatdan o‘tish',
    registerGreeting: 'Bir daqiqada hisob yarating.',
    continueWith: 'davom etish',
    fullName: 'To‘liq ism',
    email: 'Email',
    password: 'Parol',
    confirmPassword: 'Parolni tasdiqlash',
    login: 'Kirish',
    signup: 'Ro‘yxatdan o‘tish',
    google: 'Google bilan davom etish',
    or: 'yoki',
    forgot: 'Parolni unutdingizmi?',
    forgotTitle: 'Parolni tiklash',
    forgotSend: 'Tiklash havolasini yuborish',
    noAccount: 'Hisobingiz yo‘qmi?',
    haveAccount: 'Hisobingiz bormi?',
    toLogin: 'Kirish',
    toRegister: 'Ro‘yxatdan o‘tish',
    errRequiredName: 'Ismni kiriting',
    errEmail: 'Email formati noto‘g‘ri',
    errPassword: 'Parol kamida 6 belgidan iborat bo‘lsin',
    errMatch: 'Parollar mos kelmadi',
    welcome: 'Xush kelibsiz',
    resetSent: 'Tiklash havolasi yuborildi (demo)',
    sentFirebase: 'Tiklash havolasi emailingizga yuborildi',
  },
  en: {
    loginTitle: 'Log in',
    loginGreeting: 'Sign in to your account and keep going.',
    registerTitle: 'Create your SavdoPilot account',
    registerGreeting: 'Get set up in under a minute.',
    continueWith: 'Continue with',
    fullName: 'Full Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    login: 'Log in',
    signup: 'Sign up',
    google: 'Continue with Google',
    or: 'OR',
    forgot: 'Forgot password?',
    forgotTitle: 'Reset password',
    forgotSend: 'Send reset link',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    toLogin: 'Log in',
    toRegister: 'Sign up',
    errRequiredName: 'Please enter your name',
    errEmail: 'Enter a valid email address',
    errPassword: 'Password must be at least 6 characters',
    errMatch: 'Passwords do not match',
    welcome: 'Welcome',
    resetSent: 'Reset link sent (demo)',
    sentFirebase: 'Reset link sent to your email',
  },
} as const

// Keep it simple: the site is mostly Uzbek-facing; use uz copy for auth pages.
const c = pageCopy.uz

function GoogleButton({
  product,
  busy,
  onStart,
}: {
  product: ProductType | null
  busy: boolean
  onStart: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={onStart}
    >
      <GoogleIcon />
      <span>
        {c.continueWith} {product ? PRODUCT_LABELS[product] : 'Google'}
      </span>
    </Button>
  )
}

function ProductBanner({ product }: { product: ProductType | null }) {
  if (!product) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {PRODUCT_LABELS[product]}
    </motion.div>
  )
}

function FirebaseNotice() {
  const [dismissed, setDismissed] = useState(false)
  if (!firebaseConfigMissing() || dismissed) return null
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-4 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5 text-xs leading-relaxed text-accent-foreground"
    >
      <p className="font-semibold">⚠️ Firebase sozlanmagan</p>
      <p className="mt-0.5">
        Google va yangi ro‘yxatdan o‘tish hozir ishlamaydi. Faqat demo hisoblar:{' '}
        <code className="rounded bg-background/60 px-1">demo@savdopilot.uz / demo1234</code>. Sozlash:
        <code className="ml-1 rounded bg-background/60 px-1">FIREBASE_SETUP.md</code>.
      </p>
      <button
        type="button"
        className="mt-1 font-medium underline underline-offset-2"
        onClick={() => setDismissed(true)}
      >
        Yopish
      </button>
    </motion.div>
  )
}

function AuthFrame({ title, greeting, children }: { title: string; greeting?: string; children: ReactNode }) {
  return (
    <div className="mesh grid min-h-screen place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="w-full">
          <Link to="/" className="font-display text-xl">
            AventryX
          </Link>
          <h1 className="mt-4 font-display text-3xl">{title}</h1>
          {greeting && <p className="mt-1 text-sm text-muted-foreground">{greeting}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </motion.div>
    </div>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-destructive">{msg}</p>
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      <FieldError msg={error} />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

function useProductParam(): ProductType | null {
  const [params] = useSearchParams()
  const parsed = parseProduct(params.get('product'))
  return parsed
}

export function LoginPage({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' } = {}) {
  const nav = useNavigate()
  const product = useProductParam()
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'form' | 'google' | null>(null)

  function rememberProduct(p: ProductType | null) {
    if (p) {
      writeSelectedProduct(p)
      stashPendingProduct(p)
    }
  }

  function validateLogin() {
    const e: Record<string, string> = {}
    if (!EMAIL_RE.test(email)) e.email = c.errEmail
    if (password.length < 6) e.password = c.errPassword
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateSignup() {
    const e: Record<string, string> = {}
    if (!fullName.trim()) e.fullName = c.errRequiredName
    if (!EMAIL_RE.test(email)) e.email = c.errEmail
    if (password.length < 6) e.password = c.errPassword
    if (confirm !== password) e.confirm = c.errMatch
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function destination() {
    return product === 'invoices' ? '/app/collections' : '/app'
  }

  async function afterAuth(emailArg: string, fullNameArg?: string) {
    // Stamp the product direction onto the profile (demo/external bridge).
    try {
      actions.loginExternal({
        email: emailArg,
        fullName: fullNameArg,
        productType: product ?? undefined,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato')
      setBusy(null)
      return
    }
    rememberProduct(product)
    toast.success(`${c.welcome}!`)
    nav(destination(), { replace: true })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (mode === 'login' ? !validateLogin() : !validateSignup()) return
    setBusy('form')
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(fullName, email, password)
      }
      await afterAuth(email, fullName)
    } catch (err) {
      toast.error(err instanceof AuthError || err instanceof Error ? err.message : 'Xato')
      setBusy(null)
    }
  }

  async function google() {
    if (busy) return
    setBusy('google')
    try {
      const user = await signInWithGoogle(product)
      await afterAuth(user.email ?? '', user.displayName ?? undefined)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato')
      setBusy(null)
    }
  }

  const showProductTitle = product
    ? product === 'sales'
      ? mode === 'login'
        ? `${c.loginTitle} — AI Sales`
        : `${c.registerTitle} — AI Sales`
      : mode === 'login'
        ? `${c.loginTitle} — Invoices & Collections`
        : `${c.registerTitle} — Invoices & Collections`
    : mode === 'login'
      ? c.loginTitle
      : c.registerTitle

  return (
    <AuthFrame title={showProductTitle} greeting={mode === 'login' ? c.loginGreeting : c.registerGreeting}>
      <FirebaseNotice />
      <ProductBanner product={product} />

      {/* Login / Sign up switch */}
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
        {(['login', 'signup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m)
              setErrors({})
            }}
            className={`relative rounded-lg px-3 py-1.5 transition-colors ${
              mode === m ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode === m && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 rounded-lg bg-primary"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{m === 'login' ? c.toLogin : c.toRegister}</span>
          </button>
        ))}
      </div>

      <GoogleButton product={product} busy={busy !== null} onStart={google} />

      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {c.or}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-4" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Field label={c.fullName} error={errors.fullName}>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </Field>
          </motion.div>
        )}
        <Field label={c.email} error={errors.email}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </Field>
        <Field label={c.password} error={errors.password}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>
        {mode === 'signup' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Field label={c.confirmPassword} error={errors.confirm}>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </motion.div>
        )}

        <Button className="w-full" type="submit" disabled={busy !== null}>
          {busy === 'form' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {mode === 'login' ? c.login : c.signup}
              <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="mt-4 space-y-2 text-center text-sm">
        <p className="text-muted-foreground">
          {mode === 'login' ? c.noAccount : c.haveAccount}{' '}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setErrors({})
            }}
          >
            {mode === 'login' ? c.toRegister : c.toLogin}
          </button>
        </p>
        <p>
          <Link className="text-primary" to={`/forgot-password${product ? `?product=${product}` : ''}`}>
            {c.forgot}
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          Demo: demo@savdopilot.uz / demo1234 · Admin: admin@savdopilot.uz / admin1234
        </p>
      </div>
    </AuthFrame>
  )
}

export function ForgotPage() {
  const nav = useNavigate()
  const product = useProductParam()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setError(c.errEmail)
      return
    }
    setError(undefined)
    setBusy(true)
    try {
      await resetPassword(email)
      toast.success(c.resetSent)
      nav(`/login${product ? `?product=${product}` : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato')
      setBusy(false)
    }
  }

  return (
    <AuthFrame title={c.forgotTitle}>
      <FirebaseNotice />
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label={c.email} error={error}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : c.forgotSend}
        </Button>
        <p className="text-center text-sm">
          <Link className="text-primary" to={`/login${product ? `?product=${product}` : ''}`}>
            {c.toLogin}
          </Link>
        </p>
      </form>
    </AuthFrame>
  )
}

// RegisterPage is kept as a thin alias so existing imports keep working.
export function RegisterPage() {
  return <LoginPage initialMode="signup" />
}
