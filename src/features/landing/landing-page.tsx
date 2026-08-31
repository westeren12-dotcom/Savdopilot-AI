import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Mic,
  Package,
  Shield,
  Sparkles,
  Store,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { FEATURES, PLAN_PRICES } from '@/config/plans'
import { formatSom } from '@/lib/utils'
import { useState } from 'react'

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 } }

const faqs = [
  {
    q: 'AI o‘zi narx o‘ylab topadimi?',
    a: 'Yo‘q. AI faqat siz kiritgan mahsulot, narx va biznes ma’lumotlaridan foydalanadi. Topilmasa, xavfsiz javob beradi.',
  },
  {
    q: 'Telegram qanday ulanadi?',
    a: 'Bot tokenini sozlamalarga kiritasiz. Webhook o‘rnatiladi, xabarlar AI orqali javoblanadi va buyurtma/CRM yoziladi.',
  },
  {
    q: 'To‘lov Click/Payme ishlaydimi?',
    a: 'To‘lov qatlami tayyor. Hozircha mock provider, keyin Click, Payme, Uzum va Stripe ulanadi.',
  },
  {
    q: 'Demo rejim nima?',
    a: 'VITE_USE_DEMO_MODE=true bo‘lsa, fake biznes va AI javoblari bilan to‘liq oqimni sinaysiz.',
  },
]

const testimonials = [
  {
    name: 'Malika, online shop',
    text: 'Kechasi ham buyurtmalar qabul qilinadi. Men ertalab tasdiqlayman.',
  },
  {
    name: 'Sardor, barbershop',
    text: 'Bronlar Telegramda yig‘iladi. CRM’da har bir mijoz ko‘rinadi.',
  },
  {
    name: 'Nodira, o‘quv markazi',
    text: 'Narx va dars vaqti faqat biz yozganidek aytiladi — chalkashlik yo‘q.',
  },
]

export function LandingPage() {
  return (
    <div className="mesh min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-xl">
          SavdoPilot AI
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link to="/login">Kirish</Link>
          </Button>
          <Button asChild>
            <Link to="/register">7 kun bepul</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-10 text-center">
        <motion.div {...fade} className="mx-auto max-w-3xl">
          <Badge tone="gold">O‘zbekiston bizneslari uchun</Badge>
          <h1 className="font-display mt-5 text-4xl leading-tight md:text-6xl">
            Biznesingizni AI bilan avtomatlashtiring
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            AI-Sotuvchi mijozlaringizga javob beradi, buyurtmalarni qabul qiladi, SavdoPilot esa
            butun biznesingizni boshqarishga yordam beradi.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/register">
                7 kun bepul sinab ko‘rish <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Demo ko‘rish</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Muammo</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            'Mijozlar kechasi yozadi — javob kechikadi',
            'Buyurtmalar chatda yo‘qoladi',
            'Savdo, ombor va foyda bitta joyda emas',
          ].map((t) => (
            <Card key={t}>{t}</Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">SavdoPilot qanday ishlaydi</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {['Biznesni ulang', 'Mahsulot kiriting', 'AI-Sotuvchi javob beradi', 'Dashboardda boshqaring'].map(
            (t, i) => (
              <Card key={t}>
                <p className="text-sm text-muted-foreground">0{i + 1}</p>
                <p className="mt-2 font-semibold">{t}</p>
              </Card>
            ),
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl">AI-Sotuvchi</h2>
            <p className="mt-3 text-muted-foreground">
              Narx, menyu, ish vaqti, manzil, buyurtma va bron — faqat sizning ma’lumotlaringiz
              asosida. Noma’lum savolga: “Bu ma’lumotni biznes egasidan aniqlab berishimiz kerak.”
            </p>
          </div>
          <Card className="space-y-3">
            <div className="rounded-xl bg-muted p-3 text-sm">Pepperoni qancha?</div>
            <div className="rounded-xl bg-primary/10 p-3 text-sm">Pepperoni narxi 89 000 so‘m.</div>
            <div className="rounded-xl bg-muted p-3 text-sm">2 ta buyurtma qilaman</div>
            <div className="rounded-xl bg-primary/10 p-3 text-sm">
              Pepperoni uchun buyurtma qabul qilindi.
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Dashboard preview</h2>
        <Card className="mt-6 grid gap-4 md:grid-cols-4">
          {['Bugungi daromad', 'Xarajat', 'Foyda', 'Buyurtmalar'].map((k) => (
            <div key={k} className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="mt-2 font-display text-2xl">—</p>
            </div>
          ))}
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Imkoniyatlar</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Bot, t: 'AI-Sotuvchi' },
            { icon: Package, t: 'Buyurtmalar' },
            { icon: Store, t: 'Ombor + CRM' },
            { icon: Wallet, t: 'Moliya' },
            { icon: Sparkles, t: 'AI Insights' },
            { icon: Mic, t: 'Voice AI' },
            { icon: Shield, t: 'RLS + rollar' },
            { icon: Store, t: 'Telegram / Instagram' },
          ].map((f) => (
            <Card key={f.t} className="flex items-center gap-3">
              <f.icon className="h-5 w-5 text-primary" />
              <span className="font-medium">{f.t}</span>
            </Card>
          ))}
        </div>
      </section>

      <PricingBlock />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Bonuslar</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="font-semibold">6 oylik</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              +1 oy bonus. Pro: +30% AI credits. Premium: +50% credits + Voice AI.
            </p>
          </Card>
          <Card>
            <h3 className="font-semibold">12 oylik</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              +2 oy bonus. Premium — 2× AI credits, VIP support, professional onboarding.
            </p>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">FAQ</h2>
        <div className="mt-6 space-y-3">
          {faqs.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Mijozlar nima deydi</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.name}>
              <p className="text-sm">“{t.text}”</p>
              <p className="mt-3 text-xs text-muted-foreground">{t.name}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <Card className="bg-primary text-primary-foreground">
          <h2 className="font-display text-3xl">Bugun AI-Sotuvchini ishga tushiring</h2>
          <p className="mt-3 opacity-90">7 kun bepul. Kartasiz boshlash mumkin (demo).</p>
          <Button className="mt-6" variant="gold" size="lg" asChild>
            <Link to="/register">Boshlash</Link>
          </Button>
        </Card>
      </section>

      <footer className="border-t px-4 py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:justify-between">
          <p>© {new Date().getFullYear()} SavdoPilot AI</p>
          <div className="flex gap-4">
            <Link to="/pricing">Tariflar</Link>
            <Link to="/login">Kirish</Link>
            <Link to="/register">Ro‘yxatdan o‘tish</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <span className="font-medium">{q}</span>
        <ChevronDown className={cnRotate(open)} />
      </button>
      {open && <p className="mt-3 text-sm text-muted-foreground">{a}</p>}
    </Card>
  )
}

function cnRotate(open: boolean) {
  return open ? 'h-4 w-4 rotate-180' : 'h-4 w-4'
}

export function PricingBlock() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16" id="pricing">
      <h2 className="font-display text-3xl">Tariflar</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(['free', 'pro', 'premium'] as const).map((code) => (
          <Card key={code} className={code === 'premium' ? 'ring-2 ring-accent' : ''}>
            {code === 'premium' && (
              <Badge tone="gold" className="mb-2">
                Eng yaxshi qiymat — 12 oy
              </Badge>
            )}
            <h3 className="font-display text-2xl uppercase">{code}</h3>
            <p className="mt-2 font-display text-3xl">{formatSom(PLAN_PRICES[code])}</p>
            <p className="text-xs text-muted-foreground">oyiga</p>
            <ul className="mt-4 space-y-2 text-sm">
              {FEATURES[code].map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button className="mt-6 w-full" asChild>
              <Link to="/register">Tanlash</Link>
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}
