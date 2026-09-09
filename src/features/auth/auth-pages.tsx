import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { actions } from '@/store/app-store'

export function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('demo@savdopilot.uz')
  const [password, setPassword] = useState('demo1234')

  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      actions.login(email, password)
      toast.success('Xush kelibsiz')
      nav('/app')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato')
    }
  }

  return (
    <AuthFrame title="Kirish">
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Parol">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button className="w-full" type="submit">
          Kirish
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            actions.loginGoogle()
            nav('/app')
          }}
        >
          Google orqali kirish
        </Button>
        <p className="text-center text-sm">
          <Link className="text-primary" to="/forgot-password">
            Parolni unutdingizmi?
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Demo: demo@savdopilot.uz / demo1234 · Admin: admin@savdopilot.uz / admin1234
        </p>
      </form>
    </AuthFrame>
  )
}

export function RegisterPage() {
  const nav = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('restaurant')
  const [referralCode, setReferralCode] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    try {
      actions.register({
        fullName,
        email,
        password,
        businessName,
        businessType: businessType as never,
        referralCode: referralCode || undefined,
      })
      nav('/onboarding')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xato')
    }
  }

  return (
    <AuthFrame title="Ro‘yxatdan o‘tish">
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Ism">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Parol">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </Field>
        <Field label="Biznes nomi">
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
        </Field>
        <Field label="Biznes turi">
          <Input value={businessType} onChange={(e) => setBusinessType(e.target.value)} required />
        </Field>
        <Field label="Referral kod (ixtiyoriy)">
          <Input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="AVEN-AB123" />
        </Field>
        <Button className="w-full" type="submit">
          Davom etish
        </Button>
      </form>
    </AuthFrame>
  )
}

export function ForgotPage() {
  const [email, setEmail] = useState('')
  return (
    <AuthFrame title="Parolni tiklash">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          try {
            actions.resetPassword(email)
            toast.success('Demo: tiklash havolasi yuborildi (email)')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Xato')
          }
        }}
      >
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Button className="w-full">Yuborish</Button>
      </form>
    </AuthFrame>
  )
}

function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mesh grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <Link to="/" className="font-display text-xl">
          AventryX
        </Link>
        <h1 className="mt-4 font-display text-3xl">{title}</h1>
        <div className="mt-6">{children}</div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/login">Kirish</Link> · <Link to="/register">Ro‘yxat</Link>
        </p>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
