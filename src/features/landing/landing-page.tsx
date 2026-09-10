import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Globe,
  Mic,
  Package,
  Shield,
  Sparkles,
  Store,
  Wallet,
  DollarSign,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FEATURES, PLAN_PRICES } from '@/config/plans'
import { formatSom, cn } from '@/lib/utils'
import {
  AiSalesChat,
  AnimatedNumber,
  CollectionsWorkflow,
  Floating,
  useTypewriter,
} from '@/features/landing/landing-animations'
import {
  ProductCards,
  type ProductSelectionCopy,
} from '@/features/landing/product-selection'
import { stashPendingProduct, type ProductType } from '@/lib/product-context'

type Language = 'en' | 'ru' | 'uz'

type LandingCopy = {
  badge: string
  headline: string
  typingWords: string[]
  subheading: string
  ctaPrimary: string
  ctaSecondary: string
  automateQuestion: string
  pickHint: string
  chat: { who: 'customer' | 'ai'; text: string }[]
  chatSuccess: [string, string]
  dashboardLabels: {
    sales: string
    collections: string
    outstanding: string
    overdue: string
    recovered: string
    newLeads: string
    orders: string
    workflowTitle: string
  }
  dashboard: {
    sales: { newLeads: number; orders: number; sales: number }
    collections: { outstanding: number; overdue: number; recovered: number }
  }
  testimonials: { name: string; text: string }[]
  products: ProductSelectionCopy
}

const content: Record<Language, LandingCopy> = {
  en: {
    badge: 'AI-Powered Business Platform',
    headline: 'Sell more. Manage customers. Get paid faster.',
    typingWords: ['Sales', 'Invoices', 'Follow-ups', 'Collections'],
    subheading:
      'AventryX AI helps you automate sales, manage customer relationships, and collect payments — all in one platform.',
    ctaPrimary: 'Start Free',
    ctaSecondary: 'Watch Demo',
    automateQuestion: 'What would you like to automate?',
    pickHint: 'Pick a direction above to continue — you choose where SavdoPilot takes you.',
    chat: [
      { who: 'customer', text: 'Looking for a 3-bedroom apartment in Chilonzor' },
      { who: 'ai', text: "We have 3-bedroom options in Chilonzor. What's your budget range?" },
      { who: 'customer', text: 'Around $40,000-50,000' },
      { who: 'ai', text: '📍 Chilonzor-9, 3rd floor, 78m² — $45,000. Should I schedule a viewing for tomorrow at 3 PM?' },
      { who: 'customer', text: 'Sure, go ahead' },
    ],
    chatSuccess: ['Viewing confirmed — tomorrow 3:00 PM', 'Customer added to CRM'],
    dashboardLabels: {
      sales: 'Sales',
      collections: 'Collections',
      outstanding: 'Outstanding',
      overdue: 'Overdue',
      recovered: 'Recovered by AI',
      newLeads: 'New Leads',
      orders: 'Orders',
      workflowTitle: 'How AI collects your money',
    },
    dashboard: {
      sales: { newLeads: 38, orders: 24, sales: 4820 },
      collections: { outstanding: 18400, overdue: 6200, recovered: 3800 },
    },
    testimonials: [
      { name: 'Malika, online shop', text: 'Orders are accepted even at night. I confirm them in the morning.' },
      { name: 'Sardor, barbershop', text: 'Bookings are collected in Telegram. Every customer is visible in CRM.' },
      { name: 'Nodira, education center', text: 'Prices and class times are mentioned exactly as we wrote — no confusion.' },
    ],
    products: {
      automateQuestion: 'What would you like to automate?',
      cta: 'Continue',
      sales: {
        title: 'AI Sales',
        subtitle: 'Find customers, manage leads, automate follow-ups, and increase sales.',
        features: ['AI Sales Assistant', 'Lead Management', 'Customer Management', 'Sales Follow-ups', 'Orders', 'Sales Analytics'],
        workflow: ['Lead', 'Customer', 'Conversation', 'Order', 'Sale'],
        select: 'Select AI Sales',
        selected: 'Selected — continue',
      },
      invoices: {
        title: 'Invoices & Collections',
        subtitle: 'Track invoices, automate payment reminders, and get paid faster.',
        features: ['Invoice Manager', 'Due-date Tracking', 'Paid / Unpaid / Overdue', 'AI Payment Reminders', 'AI Response Understanding', 'Payment Promise Tracking', 'Collections Dashboard'],
        workflow: ['Invoice', 'Due Date', 'AI Follow-up', 'Customer Response', 'Payment'],
        select: 'Select Invoices & Collections',
        selected: 'Selected — continue',
      },
    },
  },
  ru: {
    badge: 'AI-платформа для бизнеса',
    headline: 'Продавайте больше. Управляйте клиентами. Получайте оплату быстрее.',
    typingWords: ['продажи', 'счета', 'follow-ups', 'collections'],
    subheading:
      'AventryX AI помогает автоматизировать продажи, управлять клиентами и собирать платежи — всё в одной платформе.',
    ctaPrimary: 'Начать бесплатно',
    ctaSecondary: 'Смотреть демо',
    automateQuestion: 'Что вы хотите автоматизировать?',
    pickHint: 'Выберите направление выше, чтобы продолжить.',
    chat: [
      { who: 'customer', text: 'Нужна 3-комнатная квартира в Чиланзаре' },
      { who: 'ai', text: 'У нас есть 3-комнатные варианты в Чиланзаре. Какой у вас бюджет?' },
      { who: 'customer', text: 'Примерно 40-50 тысяч долларов' },
      { who: 'ai', text: '📍 Чиланзар-9, 3-й этаж, 78м² — $45,000. Записать вас на просмотр завтра в 15:00?' },
      { who: 'customer', text: 'Да, конечно, запишите' },
    ],
    chatSuccess: ['Просмотр подтверждён — завтра в 15:00', 'Клиент добавлен в CRM'],
    dashboardLabels: {
      sales: 'Продажи',
      collections: 'Collections',
      outstanding: 'К получению',
      overdue: 'Просрочено',
      recovered: 'Возвращено AI',
      newLeads: 'Новые лиды',
      orders: 'Заказы',
      workflowTitle: 'Как AI возвращает деньги',
    },
    dashboard: {
      sales: { newLeads: 38, orders: 24, sales: 4820 },
      collections: { outstanding: 18400, overdue: 6200, recovered: 3800 },
    },
    testimonials: [
      { name: 'Малика, онлайн магазин', text: 'Заказы принимаются даже ночью. Я подтверждаю их утром.' },
      { name: 'Сардор, барбершоп', text: 'Бронирования собираются в Telegram. Каждый клиент виден в CRM.' },
      { name: 'Нодира, учебный центр', text: 'Цены и время занятий указаны так, как мы написали — нет путаницы.' },
    ],
    products: {
      automateQuestion: 'Что вы хотите автоматизировать?',
      cta: 'Продолжить',
      sales: {
        title: 'AI Продажи',
        subtitle: 'Находите клиентов, управляйте лидами, автоматизируйте follow-ups и увеличивайте продажи.',
        features: ['AI Ассистент продаж', 'Управление лидами', 'Управление клиентами', 'Follow-ups продаж', 'Заказы', 'Аналитика продаж'],
        workflow: ['Лид', 'Клиент', 'Разговор', 'Заказ', 'Продажа'],
        select: 'Выбрать AI Продажи',
        selected: 'Выбрано — продолжить',
      },
      invoices: {
        title: 'Счета и Collections',
        subtitle: 'Отслеживайте счета, автоматизируйте напоминания об оплате и получайте оплату быстрее.',
        features: ['Менеджер счетов', 'Отслеживание сроков', 'Оплачено / Неоплачено / Просрочено', 'AI Напоминания об оплате', 'AI Понимание ответов', 'Отслеживание обещаний оплаты', 'Collections Dashboard'],
        workflow: ['Счет', 'Срок оплаты', 'AI Follow-up', 'Ответ клиента', 'Оплата'],
        select: 'Выбрать Счета и Collections',
        selected: 'Выбрано — продолжить',
      },
    },
  },
  uz: {
    badge: 'AI-Powered Business Platform',
    headline: 'Ko‘proq savdo qiling. Mijozlarni boshqaring. To‘lovni tez oling.',
    typingWords: ['savdo', 'to‘lovlar', 'CRM', 'follow-up'],
    subheading:
      'AventryX AI savdolarni avtomatlashtirishga, mijozlarni boshqarishga va to‘lovlarni yig‘ishga yordam beradi — bitta platformada.',
    ctaPrimary: 'Bepul boshlash',
    ctaSecondary: 'Demo ko‘rish',
    automateQuestion: 'Nimani avtomatlashtirmoqchisiz?',
    pickHint: 'Davom etish uchun yuqoridan yo‘nalish tanlang.',
    chat: [
      { who: 'customer', text: '3 xonali kvartira kerak edi, Chilonzorda' },
      { who: 'ai', text: 'Chilonzor tumanida 3 xonali variantlarimiz bor. Byudjetingiz taxminan qancha?' },
      { who: 'customer', text: '40-50 ming dollar atrofida' },
      { who: 'ai', text: '📍 Chilonzor-9, 3-qavat, 78m² — $45,000. Ertaga soat 15:00 ga ko‘rishga yozib qo‘yaymi?' },
      { who: 'customer', text: 'Albatta, yozib qo‘ying' },
    ],
    chatSuccess: ['Ko‘rish tasdiqlandi — ertaga 15:00', 'Mijoz CRMga qo‘shildi'],
    dashboardLabels: {
      sales: 'Savdo',
      collections: 'Collections',
      outstanding: 'To‘lanmagan',
      overdue: 'Overdue',
      recovered: 'AI qaytargan',
      newLeads: 'Yangi leadlar',
      orders: 'Buyurtmalar',
      workflowTitle: 'AI pulni qanday yig‘adi',
    },
    dashboard: {
      sales: { newLeads: 38, orders: 24, sales: 4820 },
      collections: { outstanding: 18400, overdue: 6200, recovered: 3800 },
    },
    testimonials: [
      { name: 'Malika, online shop', text: 'Kechasi ham buyurtmalar qabul qilinadi. Men ertalab tasdiqlayman.' },
      { name: 'Sardor, barbershop', text: 'Bronlar Telegramda yig‘iladi. CRM’da har bir mijoz ko‘rinadi.' },
      { name: 'Nodira, o‘quv markazi', text: 'Narx va dars vaqti faqat biz yozganidek aytiladi — chalkashlik yo‘q.' },
    ],
    products: {
      automateQuestion: 'Nimani avtomatlashtirmoqchisiz?',
      cta: 'Davom etish',
      sales: {
        title: 'AI Savdo',
        subtitle: 'Mijozlarni toping, leadlarni boshqaring, follow-up’larni avtomatlashtiring va savdolarni oshiring.',
        features: ['AI Savdo Assistenti', 'Lead Boshqaruvi', 'Mijoz Boshqaruvi', 'Savdo Follow-up’lari', 'Buyurtmalar', 'Savdo Analitikasi'],
        workflow: ['Lead', 'Mijoz', 'Suhbat', 'Buyurtma', 'Savdo'],
        select: 'AI Savdo tanlash',
        selected: 'Tanlandi — davom etish',
      },
      invoices: {
        title: 'Invoicelar va Collections',
        subtitle: 'Invoicelarni kuzating, to‘lov eslatmalarini avtomatlashtiring va tezroq to‘lov oling.',
        features: ['Invoice Menjeri', 'Due-date Tracking', 'To‘langan / To‘lanmagan / Overdue', 'AI To‘lov Eslatmalari', 'AI Javob Tushunish', 'To‘lov Va‘dalari Tracking', 'Collections Dashboard'],
        workflow: ['Invoice', 'Due Date', 'AI Follow-up', 'Mijoz Javobi', 'To‘lov'],
        select: 'Invoicelar tanlash',
        selected: 'Tanlandi — davom etish',
      },
    },
  },
}

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

export function LandingPage() {
  const [language, setLanguage] = useState<Language>('uz')
  const t = content[language]
  const nav = useNavigate()
  const [selectedProduct, setSelectedProduct] = useState<ProductType | null>(null)
  const typed = useTypewriter(t.typingWords, true)

  function choose(p: ProductType) {
    setSelectedProduct(p)
    stashPendingProduct(p)
  }

  function goAuth() {
    if (!selectedProduct) return
    nav(selectedProduct === 'sales' ? '/register?product=sales' : '/register?product=invoices')
  }

  return (
    <div className="mesh min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link to="/" className="font-display text-xl">
          AventryX AI
        </Link>
        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === 'en' ? 'ru' : language === 'ru' ? 'uz' : 'en')}
              className="flex items-center gap-2"
            >
              <Globe className="h-4 w-4" />
              {language.toUpperCase()}
            </Button>
          </motion.div>
          <Button variant="ghost" asChild>
            <Link to="/login">Kirish</Link>
          </Button>
          <Button asChild>
            <Link to="/register">7 kun bepul</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: copy + interactive product selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="mb-6 inline-flex items-center rounded-full border border-input bg-background px-3 py-1 text-sm">
              <Sparkles className="mr-2 h-3 w-3 text-primary" />
              {t.badge}
            </div>

            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight md:text-4xl lg:text-5xl xl:text-6xl">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {t.headline}
              </motion.span>
            </h1>

            <p className="mt-3 flex h-6 items-center text-sm text-muted-foreground">
              <Sparkles className="mr-2 h-3.5 w-3.5 text-accent" />
              <span>{typed}</span>
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary" />
            </p>

            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg lg:text-xl">
              {t.subheading}
            </p>

            {/* Interactive product selection — replaces the old static cards */}
            <div className="mt-8">
              <p className="mb-4 text-sm font-medium text-muted-foreground">{t.automateQuestion}</p>
              <ProductCards copy={t.products} selected={selectedProduct} onSelect={choose} />

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <motion.div whileHover={selectedProduct ? { scale: 1.03 } : undefined} whileTap={selectedProduct ? { scale: 0.97 } : undefined}>
                  <Button
                    size="lg"
                    className="w-full text-base sm:w-auto"
                    disabled={!selectedProduct}
                    onClick={goAuth}
                  >
                    {selectedProduct
                      ? selectedProduct === 'sales'
                        ? `${t.products.cta} — ${t.products.sales.title}`
                        : `${t.products.cta} — ${t.products.invoices.title}`
                      : t.products.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" variant="outline" className="w-full text-base sm:w-auto" asChild>
                    <Link to="/login">{t.ctaSecondary}</Link>
                  </Button>
                </motion.div>
              </div>
              {!selectedProduct && (
                <p className="mt-3 text-xs text-muted-foreground">{t.pickHint}</p>
              )}
            </div>
          </motion.div>

          {/* Right: live AI chat preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative order-first lg:order-last"
          >
            <Floating>
              <Card className="relative bg-card p-4 shadow-2xl md:p-6">
                <div className="flex items-center gap-3 border-b pb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 md:h-10 md:w-10">
                    <Bot className="h-4 w-4 text-primary md:h-5 md:w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold md:text-base">AventryX AI</h3>
                    <p className="text-xs text-muted-foreground">Sales Assistant</p>
                  </div>
                  <div className="ml-auto">
                    <div className="inline-flex items-center rounded-full border border-input bg-background px-2 py-0.5 text-xs font-semibold">
                      Active
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <AiSalesChat lines={t.chat} />
                </div>

                <div className="mt-4 border-t pt-3">
                  {t.chatSuccess.map((s) => (
                    <div key={s} className="mt-1 flex items-center gap-2 text-xs md:text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                      <span className="text-muted-foreground">{s}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Floating>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">Muammo</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            'Mijozlar kechasi yozadi — javob kechikadi',
            'Buyurtmalar chatda yo‘qoladi',
            'Savdo, ombor va foyda bitta joyda emas',
          ].map((p) => (
            <Card key={p}>{p}</Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="font-display text-3xl">SavdoPilot qanday ishlaydi</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {['Biznesni ulang', 'Mahsulot kiriting', 'AI-Sotuvchi javob beradi', 'Dashboardda boshqaring'].map(
            (p, i) => (
              <Card key={p}>
                <p className="text-sm text-muted-foreground">0{i + 1}</p>
                <p className="mt-2 font-semibold">{p}</p>
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
        <h2 className="font-display text-3xl">Dashboard Preview</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Sales Metrics — animated numbers */}
          <Card className="border-primary/20 bg-primary/5 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{t.dashboardLabels.sales}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboardLabels.newLeads}</span>
                <span className="font-semibold">
                  <AnimatedNumber value={t.dashboard.sales.newLeads} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboardLabels.orders}</span>
                <span className="font-semibold">
                  <AnimatedNumber value={t.dashboard.sales.orders} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboardLabels.sales}</span>
                <span className="font-semibold text-green-500">
                  <AnimatedNumber value={t.dashboard.sales.sales} prefix="$" />
                </span>
              </div>
            </div>
          </Card>

          {/* Collections Metrics — animated numbers + workflow */}
          <Card className="border-green-500/20 bg-green-500/5 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">{t.dashboardLabels.collections}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboardLabels.outstanding}</span>
                <span className="font-semibold">
                  <AnimatedNumber value={t.dashboard.collections.outstanding} prefix="$" />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboardLabels.overdue}</span>
                <span className="font-semibold text-red-500">
                  <AnimatedNumber value={t.dashboard.collections.overdue} prefix="$" />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboardLabels.recovered}</span>
                <span className="font-semibold text-green-500">
                  <AnimatedNumber value={t.dashboard.collections.recovered} prefix="$" />
                </span>
              </div>
            </div>
            <div className="mt-5 border-t pt-4">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                {t.dashboardLabels.workflowTitle}
              </p>
              <CollectionsWorkflow steps={t.products.invoices.workflow} />
            </div>
          </Card>
        </div>
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
          {t.testimonials.map((x) => (
            <Card key={x.name}>
              <p className="text-sm">“{x.text}”</p>
              <p className="mt-3 text-xs text-muted-foreground">{x.name}</p>
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
          <p>© {new Date().getFullYear()} AventryX AI</p>
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
  return cn('h-4 w-4', open && 'rotate-180')
}

export function PricingBlock() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16" id="pricing">
      <h2 className="font-display text-3xl">Tariflar</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(['free', 'pro', 'premium'] as const).map((code) => (
          <Card key={code} className={code === 'premium' ? 'ring-2 ring-accent' : ''}>
            {code === 'premium' && (
              <div className="mb-2 inline-flex items-center rounded-full bg-accent/30 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                Eng yaxshi qiymat — 12 oy
              </div>
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
